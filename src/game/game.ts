import * as THREE from "three";
import { CleaningSession, TASKS } from "../core/cleaning";
import type { TaskId } from "../core/cleaning";
import { LEVELS, getLevel } from "../core/levels";
import type { Level, LevelId } from "../core/levels";
import { browserStorage, readSave, writeSave } from "../core/save";
import { readPreferences, writePreferences } from "../core/preferences";
import { Interface } from "../ui/interface";
import type { DeviceGesture } from "../ui/device";
import { World } from "./world";
import { Effects } from "./effects";
import { WaterAudio } from "./audio";

export interface ScreenSample {
  x: number;
  y: number;
  id: string;
  task: TaskId;
}
export interface GameInspection {
  level: LevelId;
  progress: number;
  tasks: Partial<Record<TaskId, number>>;
  nozzle: string;
  paused: boolean;
  complete: boolean;
  seconds: number;
  camera: number[];
  device: { x: number; y: number };
  mode: string;
}
declare global {
  interface Window {
    __cleanGame?: {
      inspect: () => GameInspection;
      samples: () => ScreenSample[];
    };
  }
}

export class Game {
  readonly ui: Interface;
  world: World;
  private session: CleaningSession;
  private effects: Effects;
  private readonly audio = new WaterAudio();
  private readonly storage = browserStorage();
  private readonly preferences = readPreferences(this.storage);
  private level: Level = getLevel(this.preferences.level);
  private readonly cleanup = new AbortController();
  private readonly pointer = new THREE.Vector2(-10, -10);
  private readonly touches = new Set<number>();
  private pointerScreen = { x: 0, y: 0 };
  private hovering = false;
  private spraying = false;
  private nozzle: "wide" | "detail" = "wide";
  private dialogKind:
    | "intro"
    | "help"
    | "pause"
    | "reset"
    | "complete"
    | "equipment"
    | "settings"
    | null = null;
  private started = false;
  private seconds = 0;
  private changed = false;
  private lastSave = 0;
  private lastHud = 0;
  private lastTime = 0;
  private frame = 0;
  private completeTimer = 0;
  private disposed = false;
  private readonly reducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  constructor(root: HTMLElement) {
    this.ui = new Interface(
      root,
      {
        start: () => this.start(),
        help: () => this.open("help"),
        pause: () => this.pause(),
        dismiss: () => this.dismiss(),
        sound: () => this.toggleSound(),
        nozzle: (mode) => this.setNozzle(mode),
        resetView: () => this.world.resetView(),
        resetPrompt: () => this.open("reset"),
        restart: () => this.restart(),
        look: () => this.look(),
        focus: (task) => {
          this.stopSpraying();
          this.world.focusTask(task);
        },
        equipment: () => this.open("equipment"),
        settings: () => this.open("settings"),
        setting: (key, value) => this.setting(key, value),
        level: (level) => this.switchLevel(level),
        device: (event) => this.deviceGesture(event),
      },
      this.level,
    );
    this.world = new World(this.ui.scene, this.level.id);
    this.effects = new Effects(this.world.scene);
    const saved = readSave(this.storage, this.level.id);
    this.session = new CleaningSession(
      this.world.surfaces.map((surface) => surface.spec),
      saved?.surfaces,
      this.level.tasks,
    );
    this.seconds = saved?.seconds ?? 0;
    this.started = saved?.started ?? false;
    // Existing courtyard mute preference is retained on the first v2 visit.
    try {
      if (!this.storage?.getItem("clean-a-little:preferences:v2") && saved)
        this.preferences.muted = saved.muted;
    } catch {
      /* A denied read does not block play. */
    }
    this.bindSurfaces();
    this.applyPreferences();
    this.ui.update(this.session);
    for (const level of LEVELS) {
      const snapshot = readSave(this.storage, level.id)?.surfaces;
      this.ui.setCompleted(
        level.id,
        !!snapshot &&
          Object.keys(snapshot).length > 0 &&
          Object.values(snapshot).every((cells) =>
            cells.every((cell) => cell === 0),
          ),
      );
    }
    this.listenWorld();
    this.listen();
    if (this.session.completed) {
      this.dialogKind = "complete";
      this.ui.complete(this.seconds);
    } else if (!this.started) {
      this.dialogKind = "intro";
      this.ui.intro(false);
    }
    if (import.meta.env.DEV)
      window.__cleanGame = {
        inspect: () => this.inspect(),
        samples: () => this.samples(),
      };
    this.frame = requestAnimationFrame(this.tick);
  }
  private bindSurfaces(): void {
    for (const surface of this.world.surfaces)
      surface.bind(this.session.surfaces.get(surface.spec.id)!.grid);
  }
  private get playing(): boolean {
    return (
      this.started &&
      !this.dialogKind &&
      !this.session.completed &&
      document.visibilityState === "visible"
    );
  }
  private point(x: number, y: number): void {
    const bounds = this.ui.scene.getBoundingClientRect();
    this.pointerScreen = { x, y };
    this.pointer.set((x / bounds.width) * 2 - 1, 1 - (y / bounds.height) * 2);
    this.hovering = true;
  }
  private listenWorld(): void {
    const canvas = this.world.renderer.domElement;
    // Canvas listeners die with its World, while global listeners are registered only once.
    canvas.addEventListener("pointerdown", (event) => {
      this.point(event.clientX, event.clientY);
      if (event.pointerType === "touch") this.touches.add(event.pointerId);
      if (this.touches.size > 1 || event.button !== 0) {
        this.stopSpraying();
        return;
      }
      if (this.playing) {
        this.audio.ensure();
        this.spraying = true;
        canvas.setPointerCapture(event.pointerId);
      }
    });
    canvas.addEventListener("pointermove", (event) =>
      this.point(event.clientX, event.clientY),
    );
    const release = (event: PointerEvent) => {
      this.touches.delete(event.pointerId);
      this.stopSpraying();
      if (event.pointerType === "touch") this.hovering = false;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", () => this.stopSpraying());
    canvas.addEventListener("pointerleave", () => {
      if (!this.spraying) this.hovering = false;
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.world.controls.addEventListener("start", () => this.stopSpraying());
  }
  private listen(): void {
    const options = { signal: this.cleanup.signal };
    window.addEventListener(
      "blur",
      () => {
        this.stopSpraying();
        this.touches.clear();
        if (this.playing) this.pause();
      },
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          this.stopSpraying();
          this.touches.clear();
          this.pause();
        }
      },
      options,
    );
    window.addEventListener(
      "pagehide",
      () => {
        this.stopSpraying();
        this.save();
      },
      options,
    );
    window.addEventListener(
      "keydown",
      (event) => {
        if (
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          (event.target instanceof HTMLElement &&
            event.target.matches("input,textarea,select,[contenteditable]"))
        )
          return;
        if (event.key === "Escape" && !this.ui.dialog.open) {
          event.preventDefault();
          this.pause();
          return;
        }
        if (this.ui.dialog.open) return;
        if (event.key === "1") this.setNozzle("wide");
        if (event.key === "2") this.setNozzle("detail");
        if (event.key.toLowerCase() === "r") this.world.resetView();
        if (event.key.toLowerCase() === "m") this.toggleSound();
      },
      options,
    );
  }
  private deviceGesture(event: DeviceGesture): void {
    if (event.phase === "end") {
      this.spraying = false;
      this.audio.spray(false);
      if (this.session) this.ui.update(this.session);
      return;
    }
    this.point(event.x, event.y);
    if (event.phase === "start" && this.playing) {
      this.audio.ensure();
      this.spraying = true;
    }
  }
  private stopSpraying(): void {
    this.spraying = false;
    this.audio.spray(false);
    this.ui?.device?.stop();
    if (this.session) this.ui.update(this.session);
  }
  private start(): void {
    this.audio.ensure();
    this.started = true;
    this.dialogKind = null;
    this.ui.close();
    this.save();
  }
  private open(kind: "help" | "reset" | "equipment" | "settings"): void {
    this.stopSpraying();
    this.save();
    this.dialogKind = kind;
    if (kind === "help") this.ui.intro(this.started);
    else if (kind === "reset") this.ui.confirmReset();
    else if (kind === "equipment") this.ui.equipment();
    else this.ui.settings(this.preferences);
  }
  private pause(): void {
    this.stopSpraying();
    this.save();
    if (this.dialogKind || this.session.completed) return;
    this.dialogKind = "pause";
    this.ui.pause();
  }
  private dismiss(): void {
    if (this.dialogKind === "intro" || this.dialogKind === "help") {
      this.start();
      return;
    }
    this.ui.close();
    this.dialogKind = null;
    this.save();
  }
  private switchLevel(id: LevelId): void {
    this.stopSpraying();
    clearTimeout(this.completeTimer);
    this.save();
    this.ui.close();
    if (id === this.level.id) {
      this.dialogKind = null;
      return;
    }
    this.effects.dispose();
    this.world.dispose();
    this.touches.clear();
    this.hovering = false;
    this.pointer.set(-10, -10);
    this.level = getLevel(id);
    this.preferences.level = id;
    this.world = new World(this.ui.scene, id);
    this.effects = new Effects(this.world.scene);
    const saved = readSave(this.storage, id);
    this.session = new CleaningSession(
      this.world.surfaces.map((surface) => surface.spec),
      saved?.surfaces,
      this.level.tasks,
    );
    this.seconds = saved?.seconds ?? 0;
    this.started = true;
    this.dialogKind = null;
    this.changed = false;
    this.bindSurfaces();
    this.ui.setLevel(this.level);
    this.ui.update(this.session);
    this.applyPreferences();
    this.listenWorld();
    this.save();
    this.ui.toast(`${this.level.model} 就位，来${this.level.action}吧。`);
  }
  private restart(): void {
    this.stopSpraying();
    clearTimeout(this.completeTimer);
    this.ui.close();
    this.session = new CleaningSession(
      this.world.surfaces.map((surface) => surface.spec),
      {},
      this.level.tasks,
    );
    this.bindSurfaces();
    this.seconds = 0;
    this.started = true;
    this.dialogKind = null;
    this.ui.update(this.session);
    this.world.resetView();
    this.ui.device.dock();
    this.audio.ensure();
    this.save();
  }
  private look(): void {
    this.ui.close();
    this.dialogKind = null;
    this.world.resetView();
  }
  private toggleSound(): void {
    this.audio.ensure();
    this.preferences.muted = !this.preferences.muted;
    this.applyPreferences();
    this.save();
  }
  private setting(
    key: "night" | "volume" | "motion",
    value: boolean | number,
  ): void {
    if (key === "volume" && typeof value === "number")
      this.preferences.volume = Math.min(100, Math.max(0, value));
    else if (key !== "volume" && typeof value === "boolean")
      this.preferences[key] = value;
    this.applyPreferences();
  }
  private applyPreferences(): void {
    this.audio.muted = this.preferences.muted;
    this.audio.volume = this.preferences.volume / 100;
    this.audio.mode = this.level.mode;
    this.audio.spray(this.spraying);
    this.world.setEnvironment(this.preferences.night);
    this.ui.setPreferences(this.preferences);
    writePreferences(this.storage, this.preferences);
  }
  private setNozzle(mode: "wide" | "detail"): void {
    this.nozzle = mode;
    this.ui.setNozzle(mode);
  }
  private save(): void {
    if (!this.session) return;
    const saved = writeSave(this.storage, {
      version: 1,
      level: this.level.id,
      seconds: Math.min(this.seconds, 604800),
      muted: this.preferences.muted,
      started: this.started,
      surfaces: this.session.snapshot(),
    });
    this.ui.setSaving(saved);
    this.changed = false;
  }
  private tick = (time: number): void => {
    if (this.disposed) return;
    const dt = this.lastTime
      ? Math.min((time - this.lastTime) / 1000, 0.05)
      : 0;
    this.lastTime = time;
    const playing = this.playing;
    if (playing) this.seconds += dt;
    const hit =
      this.hovering && !this.dialogKind
        ? this.world.intersect(this.pointer)
        : undefined;
    const surface = hit?.object.userData.surfaceId
      ? this.world.surfaces.find(
          (surface) => surface.spec.id === hit.object.userData.surfaceId,
        )
      : undefined;
    const active = this.spraying && playing;
    const radius = this.nozzle === "wide" ? 0.48 : 0.23;
    if (
      active &&
      hit?.uv &&
      surface &&
      !this.session.isFinished(surface.spec.task)
    ) {
      const removed = surface.paint(
        hit.uv,
        radius,
        dt,
        this.level.mode === "steam" ? 6 : this.nozzle === "wide" ? 7 : 11,
        this.level.mode,
      );
      if (removed > 0) this.changed = true;
      const completed = this.session.settle();
      if (completed.length) {
        for (const item of this.world.surfaces)
          if (completed.includes(item.spec.task)) item.redraw();
        this.ui.toast(
          `${TASKS.find((task) => task.id === completed[0])!.name}，洗干净了！`,
        );
        this.audio.chime(this.session.completed);
        this.save();
      }
      if (this.session.completed) {
        this.stopSpraying();
        this.ui.update(this.session);
        this.save();
        this.completeTimer = window.setTimeout(() => {
          if (!this.disposed && this.session.completed && !this.dialogKind) {
            this.dialogKind = "complete";
            this.ui.complete(this.seconds);
          }
        }, 650);
      }
    }
    this.audio.spray(active);
    this.effects.update(
      dt,
      active,
      hit,
      this.world.camera,
      radius,
      this.ui.sprayOrigin,
      this.level.mode,
    );
    this.ui.cursor(
      this.pointerScreen.x,
      this.pointerScreen.y,
      this.hovering && !this.dialogKind,
      active,
      surface?.spec.task,
    );
    if (time - this.lastHud > 100) {
      this.ui.update(this.session);
      this.lastHud = time;
    }
    if (this.changed && time - this.lastSave > 900) {
      this.save();
      this.lastSave = time;
    }
    this.world.render(
      time / 1000,
      this.session.progress,
      this.preferences.motion && !this.reducedMotion.matches,
    );
    this.frame = requestAnimationFrame(this.tick);
  };
  private inspect(): GameInspection {
    return {
      level: this.level.id,
      progress: this.session.progress,
      tasks: Object.fromEntries(
        this.level.tasks.map((id) => [id, this.session.taskProgress(id)]),
      ),
      nozzle: this.nozzle,
      paused: !!this.dialogKind,
      complete: this.session.completed,
      seconds: this.seconds,
      camera: this.world.camera.position.toArray(),
      device: this.ui.device.snapshot(),
      mode: this.level.mode,
    };
  }
  private samples(): ScreenSample[] {
    const result: ScreenSample[] = [];
    const rect = this.world.renderer.domElement.getBoundingClientRect();
    this.world.scene.updateMatrixWorld(true);
    this.world.camera.updateMatrixWorld(true);
    for (const surface of this.world.surfaces) {
      const countU = surface.tubular ? 1 : Math.ceil(surface.spanU / 0.3);
      const countV = Math.ceil(surface.spanV / 0.26);
      for (let x = 0; x < countU; x++)
        for (let y = 0; y < countV; y++) {
          let local: THREE.Vector3;
          if (surface.tubular) {
            const cameraLocal = surface.mesh.worldToLocal(
              this.world.camera.position.clone(),
            );
            const angle = Math.atan2(cameraLocal.z, cameraLocal.x);
            const radius = surface.spanU / (Math.PI * 2);
            local = new THREE.Vector3(
              Math.cos(angle) * radius * 1.005,
              ((y + 0.5) / countV - 0.5) * surface.spanV,
              Math.sin(angle) * radius * 1.005,
            );
          } else
            local = new THREE.Vector3(
              ((x + 0.5) / countU - 0.5) * surface.spanU,
              ((y + 0.5) / countV - 0.5) * surface.spanV,
              0,
            );
          const ndc = surface.mesh
            .localToWorld(local)
            .project(this.world.camera);
          const hit = this.world.intersect(new THREE.Vector2(ndc.x, ndc.y));
          if (hit?.object.userData.surfaceId !== surface.spec.id) continue;
          const px = rect.left + ((ndc.x + 1) / 2) * rect.width,
            py = rect.top + ((1 - ndc.y) / 2) * rect.height;
          if (px < 0 || px > rect.width || py < 0 || py > rect.height) continue;
          result.push({
            x: px,
            y: py,
            id: surface.spec.id,
            task: surface.spec.task,
          });
        }
    }
    return result;
  }
  dispose(): void {
    this.save();
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.completeTimer);
    this.cleanup.abort();
    this.effects.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.ui.dispose();
    if (import.meta.env.DEV) delete window.__cleanGame;
  }
}
