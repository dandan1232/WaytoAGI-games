import * as THREE from 'three';
import { CleaningSession, TASKS } from '../core/cleaning';
import type { TaskId } from '../core/cleaning';
import { browserStorage, readSave, writeSave } from '../core/save';
import { Interface } from '../ui/interface';
import { World } from './world';
import { Effects } from './effects';
import { WaterAudio } from './audio';

export interface ScreenSample { x: number; y: number; id: string; task: TaskId; }
export interface GameInspection { progress: number; tasks: Record<TaskId, number>; nozzle: string; paused: boolean; complete: boolean; seconds: number; camera: number[]; }
declare global {
  interface Window { __cleanGame?: { inspect: () => GameInspection; samples: () => ScreenSample[] }; }
}

export class Game {
  readonly ui: Interface;
  readonly world: World;
  private session: CleaningSession;
  private readonly effects: Effects;
  private readonly audio = new WaterAudio();
  private readonly storage = browserStorage();
  private readonly cleanup = new AbortController();
  private readonly pointer = new THREE.Vector2(-10, -10);
  private readonly touches = new Set<number>();
  private pointerScreen = { x: 0, y: 0 };
  private hovering = false;
  private spraying = false;
  private nozzle: 'wide' | 'detail' = 'wide';
  private dialogKind: 'intro' | 'help' | 'pause' | 'reset' | 'complete' | 'equipment' | null = null;
  private started = false;
  private seconds = 0;
  private changed = false;
  private lastSave = 0;
  private lastHud = 0;
  private lastTime = 0;
  private frame = 0;
  private completeTimer = 0;
  private disposed = false;

  constructor(root: HTMLElement) {
    this.ui = new Interface(root, {
      start: () => this.start(), help: () => this.help(), pause: () => this.pause(), dismiss: () => this.dismiss(),
      sound: () => this.toggleSound(), nozzle: (mode) => this.setNozzle(mode), resetView: () => this.world.resetView(),
      resetPrompt: () => this.resetPrompt(), restart: () => this.restart(), look: () => this.look(),
      focus: (task) => { this.stopSpraying(); this.world.focusTask(task); },
      equipment: () => this.equipment(),
    });
    this.world = new World(this.ui.scene);
    this.effects = new Effects(this.world.scene);
    const saved = readSave(this.storage);
    this.session = new CleaningSession(this.world.surfaces.map((surface) => surface.spec), saved?.surfaces);
    this.seconds = saved?.seconds ?? 0; this.started = saved?.started ?? false; this.audio.muted = saved?.muted ?? false;
    this.bindSurfaces(); this.ui.update(this.session); this.ui.setMuted(this.audio.muted);
    this.listen();
    if (this.session.completed) { this.dialogKind = 'complete'; this.ui.complete(this.seconds); }
    else if (!this.started) { this.dialogKind = 'intro'; this.ui.intro(false); }
    else this.ui.toast('欢迎回来，继续这一小片好心情。');
    if (import.meta.env.DEV) window.__cleanGame = { inspect: () => this.inspect(), samples: () => this.samples() };
    this.frame = requestAnimationFrame(this.tick);
  }

  private bindSurfaces(): void { for (const surface of this.world.surfaces) surface.bind(this.session.surfaces.get(surface.spec.id)!.grid); }
  private get playing(): boolean { return this.started && !this.dialogKind && !this.session.completed && document.visibilityState === 'visible'; }

  private listen(): void {
    const canvas = this.world.renderer.domElement; const options = { signal: this.cleanup.signal };
    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      this.pointerScreen = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    canvas.addEventListener('pointerdown', (event) => {
      updatePointer(event); this.hovering = true;
      if (event.pointerType === 'touch') this.touches.add(event.pointerId);
      if (this.touches.size > 1 || event.button !== 0) { this.stopSpraying(); return; }
      if (this.playing) { this.audio.ensure(); this.spraying = true; canvas.setPointerCapture(event.pointerId); }
    }, options);
    canvas.addEventListener('pointermove', (event) => { updatePointer(event); this.hovering = true; }, options);
    const release = (event: PointerEvent) => { this.touches.delete(event.pointerId); this.stopSpraying(); if (event.pointerType === 'touch') this.hovering = false; };
    canvas.addEventListener('pointerup', release, options); canvas.addEventListener('pointercancel', release, options);
    canvas.addEventListener('lostpointercapture', () => this.stopSpraying(), options);
    canvas.addEventListener('pointerleave', () => { if (!this.spraying) this.hovering = false; }, options);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options);
    this.world.controls.addEventListener('start', () => this.stopSpraying());
    window.addEventListener('blur', () => { this.stopSpraying(); this.touches.clear(); if (this.playing) this.pause(); }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.stopSpraying(); this.touches.clear(); this.pause(); } }, options);
    window.addEventListener('pagehide', () => { this.stopSpraying(); this.save(); }, options);
    window.addEventListener('keydown', (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.matches('input,textarea,select,[contenteditable]'))) return;
      if (event.key === 'Escape' && !this.ui.dialog.open) { event.preventDefault(); this.pause(); return; }
      if (this.ui.dialog.open) return;
      if (event.key === '1') this.setNozzle('wide');
      if (event.key === '2') this.setNozzle('detail');
      if (event.key.toLowerCase() === 'r') this.world.resetView();
      if (event.key.toLowerCase() === 'm') this.toggleSound();
    }, options);
  }

  private start(): void {
    this.audio.ensure(); this.started = true; this.dialogKind = null; this.ui.close(); this.save();
  }
  private stopSpraying(): void { this.spraying = false; this.audio.spray(false); }
  private help(): void { this.stopSpraying(); this.dialogKind = 'help'; this.ui.intro(this.started); }
  private equipment(): void { this.stopSpraying(); this.save(); this.dialogKind = 'equipment'; this.ui.equipment(); }
  private pause(): void {
    this.stopSpraying(); this.save();
    if (this.dialogKind || this.session.completed) return;
    this.dialogKind = 'pause'; this.ui.pause();
  }
  private dismiss(): void {
    if (this.dialogKind === 'intro' || this.dialogKind === 'help') { this.start(); return; }
    this.ui.close(); this.dialogKind = null; this.save();
  }
  private resetPrompt(): void { this.stopSpraying(); this.save(); this.dialogKind = 'reset'; this.ui.confirmReset(); }
  private restart(): void {
    this.stopSpraying(); clearTimeout(this.completeTimer); this.ui.close();
    this.session = new CleaningSession(this.world.surfaces.map((surface) => surface.spec));
    this.bindSurfaces(); this.seconds = 0; this.started = true; this.dialogKind = null;
    this.ui.update(this.session); this.world.resetView(); this.audio.ensure(); this.save(); this.ui.toast('新的小任务，新的好心情。');
  }
  private look(): void { this.ui.close(); this.dialogKind = null; this.world.resetView(); this.ui.toast('这一小片干净，属于你。右键转动，好好看看。'); }
  private toggleSound(): void { this.audio.ensure(); this.audio.muted = !this.audio.muted; this.audio.spray(this.spraying); this.ui.setMuted(this.audio.muted); this.save(); }
  private setNozzle(mode: 'wide' | 'detail'): void { this.nozzle = mode; this.ui.setNozzle(mode); }

  private save(): void {
    const saved = writeSave(this.storage, { version: 1, level: 'courtyard', seconds: Math.min(this.seconds, 604800), muted: this.audio.muted, started: this.started, surfaces: this.session.snapshot() });
    this.ui.setSaving(saved); this.changed = false;
  }

  private tick = (time: number): void => {
    if (this.disposed) return;
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = time;
    const playing = this.playing;
    if (playing) this.seconds += dt;
    const hit = this.hovering && !this.dialogKind ? this.world.intersect(this.pointer) : undefined;
    const surface = hit?.object.userData.surfaceId ? this.world.surfaces.find((item) => item.spec.id === hit.object.userData.surfaceId) : undefined;
    const active = this.spraying && playing;
    const radius = this.nozzle === 'wide' ? 0.37 : 0.18;
    if (active && hit?.uv && surface && !this.session.isFinished(surface.spec.task)) {
      const removed = surface.paint(hit.uv, radius, dt, this.nozzle === 'wide' ? 5.5 : 10);
      if (removed > 0) this.changed = true;
      const completed = this.session.settle();
      if (completed.length) {
        for (const item of this.world.surfaces) { if (completed.includes(item.spec.task)) item.redraw(); }
        this.ui.toast(`${TASKS.find((task) => task.id === completed[0])!.name}洗净了，真好。`);
        this.audio.chime(this.session.completed); this.save();
      }
      if (this.session.completed) {
        this.stopSpraying(); this.ui.update(this.session); this.save();
        this.completeTimer = window.setTimeout(() => { if (!this.disposed && this.session.completed && !this.dialogKind) { this.dialogKind = 'complete'; this.ui.complete(this.seconds); } }, 850);
      }
    }
    this.audio.spray(active);
    this.effects.update(dt, active, hit, this.world.camera, radius, this.ui.sprayOrigin);
    this.ui.cursor(this.pointerScreen.x, this.pointerScreen.y, this.hovering && !this.dialogKind, active, surface?.spec.task);
    if (time - this.lastHud > 100) { this.ui.update(this.session); this.lastHud = time; }
    if (this.changed && time - this.lastSave > 900) { this.save(); this.lastSave = time; }
    this.world.render(time / 1000, this.session.progress);
    this.frame = requestAnimationFrame(this.tick);
  };

  private inspect(): GameInspection {
    return { progress: this.session.progress, tasks: Object.fromEntries(TASKS.map(({ id }) => [id, this.session.taskProgress(id)])) as Record<TaskId, number>, nozzle: this.nozzle, paused: !!this.dialogKind, complete: this.session.completed, seconds: this.seconds, camera: this.world.camera.position.toArray() };
  }

  /** Read-only world-to-screen probes, stripped from production builds. Tests still use real pointer input. */
  private samples(): ScreenSample[] {
    const result: ScreenSample[] = []; const rect = this.world.renderer.domElement.getBoundingClientRect();
    this.world.scene.updateMatrixWorld(true); this.world.camera.updateMatrixWorld(true);
    for (const surface of this.world.surfaces) {
      const countU = surface.tubular ? 1 : Math.ceil(surface.spanU / 0.22);
      const countV = Math.ceil(surface.spanV / 0.19);
      for (let x = 0; x < countU; x++) for (let y = 0; y < countV; y++) {
        let local: THREE.Vector3;
        if (surface.tubular) {
          const cameraLocal = surface.mesh.worldToLocal(this.world.camera.position.clone());
          const angle = Math.atan2(cameraLocal.z, cameraLocal.x);
          const radius = surface.spanU / (Math.PI * 2);
          local = new THREE.Vector3(Math.cos(angle) * radius * 1.005, ((y + 0.5) / countV - 0.5) * surface.spanV, Math.sin(angle) * radius * 1.005);
        } else local = new THREE.Vector3(((x + 0.5) / countU - 0.5) * surface.spanU, ((y + 0.5) / countV - 0.5) * surface.spanV, 0);
        const ndc = surface.mesh.localToWorld(local).project(this.world.camera);
        const hit = this.world.intersect(new THREE.Vector2(ndc.x, ndc.y));
        if (hit?.object.userData.surfaceId !== surface.spec.id) continue;
        result.push({ x: rect.left + (ndc.x + 1) / 2 * rect.width, y: rect.top + (1 - ndc.y) / 2 * rect.height, id: surface.spec.id, task: surface.spec.task });
      }
    }
    return result;
  }

  dispose(): void {
    this.save(); this.disposed = true; cancelAnimationFrame(this.frame); clearTimeout(this.completeTimer);
    this.cleanup.abort(); this.effects.dispose(); this.audio.dispose(); this.world.dispose(); this.ui.dispose();
    if (import.meta.env.DEV) delete window.__cleanGame;
  }
}
