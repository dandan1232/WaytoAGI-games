import { TASKS } from '../core/cleaning';
import type { CleaningSession, TaskId } from '../core/cleaning';

const paths: Record<string, string> = {
  spark: '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/>',
  water: '<path d="M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  focus: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  bike: '<circle cx="5" cy="16" r="4"/><circle cx="19" cy="16" r="4"/><path d="m5 16 5-9 5 9H5m5-9h6l3 9M8 4h4m3 0h3l1 4"/>',
  bench: '<path d="M4 5h16v7H4zM3 15h18v3H3zm2 3v3m14-3v3M6 8h12M6 12v3m12-3v3"/>',
  tiles: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>',
  sound: '<path d="m11 4-5 4H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-5 4H3v8h3l5 4V4Zm5 5 6 6m0-6-6 6"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  camera: '<path d="M3 7h5l2-3h4l2 3h5v14H3Z"/><circle cx="12" cy="13" r="4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v8M6 10h12"/>',
  leaf: '<path d="M20 3C9 2 3 6 4 13c1 7 9 9 13 3 3-4 3-9 3-13ZM5 20 16 8"/>',
};
export function icon(name: string, className = ''): string { return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.spark}</svg>`; }

export interface Actions {
  start: () => void;
  help: () => void;
  pause: () => void;
  dismiss: () => void;
  sound: () => void;
  nozzle: (nozzle: 'wide' | 'detail') => void;
  resetView: () => void;
  resetPrompt: () => void;
  restart: () => void;
  look: () => void;
  focus: (task: TaskId) => void;
}

export class Interface {
  readonly scene: HTMLElement;
  readonly dialog: HTMLDialogElement;
  private readonly cleanup = new AbortController();
  private toastTimer = 0;
  private lastTarget: TaskId | undefined | null = null;

  constructor(readonly root: HTMLElement, private readonly actions: Actions) {
    root.innerHTML = `
      <div class="scene" id="scene"></div>
      <div class="vignette" aria-hidden="true"></div>
      <header class="header">
        <a class="brand" href="./" aria-label="清洁一平方米首页"><span class="brand-symbol">${icon('spark')}</span><span><strong>清洁一平方米</strong><small>CLEAN A LITTLE</small></span></a>
        <div class="station"><span class="live-dot"></span> 第一站 · 日常庭院 <span class="station-number">01 / 01</span></div>
        <nav class="header-actions" aria-label="游戏设置">
          <button class="icon-button" id="help" title="操作指引" aria-label="操作指引">${icon('help')}</button>
          <button class="icon-button" id="sound" title="关闭音效" aria-label="关闭音效" aria-pressed="false">${icon('sound')}</button>
          <button class="icon-button pause-button" id="pause" title="暂停游戏" aria-label="暂停游戏">${icon('pause')}</button>
        </nav>
      </header>
      <section class="intro" aria-label="当前关卡">
        <div class="eyebrow"><span>VOL. 01</span> 一座被遗忘的庭院</div>
        <h1>把日常，<br>洗成好心情<span>。</span></h1>
        <p>不赶时间。让眼前这一小片，<br>慢慢恢复本来的颜色。</p>
        <div class="mood-tag">${icon('leaf')} 今天，给自己一点小小的成就感</div>
      </section>
      <aside class="mission-panel" aria-label="清洁任务">
        <div class="progress-overview">
          <div><span class="small-label">庭院焕新进度</span><div class="progress-number"><span id="total-progress" data-testid="total-progress">0</span><small>%</small></div></div>
          <div class="progress-flower" aria-hidden="true">${icon('spark')}<svg class="progress-ring" viewBox="0 0 72 72"><circle class="ring-track" cx="36" cy="36" r="31"/><circle id="progress-ring" class="ring-value" cx="36" cy="36" r="31"/></svg></div>
        </div>
        <div class="mission-divider"></div>
        <div class="task-heading"><span>这一站的小任务</span><span id="task-count">0 / 3</span></div>
        <div class="task-list">${TASKS.map((task) => `<button class="task" id="task-${task.id}" data-task="${task.id}" title="聚焦${task.name}" aria-label="聚焦${task.name}"><span class="task-icon">${icon(task.icon)}<span class="task-check">${icon('check')}</span></span><span class="task-content"><span class="task-title">${task.name}<span id="percent-${task.id}">0%</span></span><span class="task-subtitle">${task.subtitle}</span><span class="task-track"><span id="bar-${task.id}"></span></span></span></button>`).join('')}</div>
        <div class="gentle-note">${icon('water')} 一点一点，干净就会发生。</div>
      </aside>
      <div class="target-hint" id="target-hint" aria-live="polite">${icon('mouse')} 按住左键清洗，右键转动庭院</div>
      <div class="reticle" id="reticle" hidden><span></span><i></i></div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
      <nav class="toolbar" aria-label="清洁工具">
        <div class="tool-description"><span class="tool-device">${icon('water')}</span><span><strong>随心清洗</strong><small>选一种喜欢的节奏</small></span></div>
        <span class="toolbar-divider"></span>
        <button class="nozzle active" id="nozzle-wide" aria-pressed="true">${icon('water')}<span>广角清洗</span><kbd>1</kbd></button>
        <button class="nozzle" id="nozzle-detail" aria-pressed="false">${icon('focus')}<span>集中点喷</span><kbd>2</kbd></button>
        <span class="toolbar-divider"></span>
        <button class="icon-button" id="reset-view" title="复位视角 · R" aria-label="复位视角">${icon('camera')}</button>
        <button class="icon-button" id="reset-game" title="重新开始" aria-label="重新开始">${icon('reset')}</button>
      </nav>
      <footer class="footer"><span>${icon('leaf')} 清洁一小处 · 好心情多一点</span><span id="save-status"><i class="save-dot"></i> 进度仅保存在这台设备</span></footer>
      <dialog class="modal" id="modal" aria-labelledby="modal-title"></dialog>`;
    this.scene = this.get('scene');
    this.dialog = this.get<HTMLDialogElement>('modal');
    const buttons: Record<string, () => void> = { help: actions.help, sound: actions.sound, pause: actions.pause, 'nozzle-wide': () => actions.nozzle('wide'), 'nozzle-detail': () => actions.nozzle('detail'), 'reset-view': actions.resetView, 'reset-game': actions.resetPrompt };
    for (const [id, handler] of Object.entries(buttons)) this.get(id).addEventListener('click', handler, { signal: this.cleanup.signal });
    for (const { id } of TASKS) this.get(`task-${id}`).addEventListener('click', () => actions.focus(id), { signal: this.cleanup.signal });
    this.dialog.addEventListener('cancel', (event) => { event.preventDefault(); actions.dismiss(); }, { signal: this.cleanup.signal });
  }

  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.root.querySelector<T>(`#${id}`)!; }

  update(session: CleaningSession): void {
    const percent = Math.floor(session.progress * 100 + 0.00001);
    this.get('total-progress').textContent = String(percent);
    this.get('progress-ring').style.strokeDashoffset = String(195 * (1 - session.progress));
    let done = 0;
    for (const { id } of TASKS) {
      const complete = session.isFinished(id); if (complete) done++;
      this.get(`percent-${id}`).textContent = complete ? '完成' : `${Math.floor(session.taskProgress(id) * 100)}%`;
      this.get(`bar-${id}`).style.width = `${session.taskProgress(id) * 100}%`;
      this.get(`task-${id}`).dataset.complete = String(complete);
    }
    this.get('task-count').textContent = `${done} / 3`;
    this.root.classList.toggle('all-clean', session.completed);
  }

  setNozzle(mode: 'wide' | 'detail'): void {
    for (const nozzle of ['wide', 'detail']) {
      this.get(`nozzle-${nozzle}`).classList.toggle('active', nozzle === mode);
      this.get(`nozzle-${nozzle}`).setAttribute('aria-pressed', String(nozzle === mode));
    }
    this.get('reticle').classList.toggle('detail', mode === 'detail');
  }

  setMuted(muted: boolean): void {
    const button = this.get('sound'); button.innerHTML = icon(muted ? 'mute' : 'sound');
    button.setAttribute('aria-label', muted ? '开启音效' : '关闭音效'); button.setAttribute('title', muted ? '开启音效 · M' : '关闭音效 · M');
    button.setAttribute('aria-pressed', String(muted));
  }

  setSaving(ok: boolean): void {
    this.get('save-status').innerHTML = ok ? '<i class="save-dot"></i> 进度已自动保存' : '<i class="save-dot offline"></i> 本次进度暂时无法保存';
  }

  cursor(x: number, y: number, visible: boolean, spraying: boolean, task?: TaskId): void {
    const cursor = this.get('reticle'); cursor.hidden = !visible; cursor.style.left = `${x}px`; cursor.style.top = `${y}px`;
    cursor.classList.toggle('spraying', spraying); cursor.classList.toggle('on-target', !!task);
    if (task !== this.lastTarget) {
      this.get('target-hint').innerHTML = task ? `${icon('water')} ${TASKS.find((item) => item.id === task)!.name} · 按住，让颜色回来` : `${icon('mouse')} 按住清洗 · 右键转动 · 滚轮缩放`;
      this.lastTarget = task;
    }
  }

  toast(message: string): void {
    const element = this.get('toast'); element.textContent = message; element.classList.add('visible');
    clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => element.classList.remove('visible'), 2800);
  }

  private modal(html: string, handlers: Record<string, () => void>): void {
    if (this.dialog.open) this.dialog.close();
    this.dialog.innerHTML = html;
    for (const [id, handler] of Object.entries(handlers)) this.get(id).addEventListener('click', handler, { once: true });
    this.dialog.showModal();
  }

  intro(resuming: boolean): void {
    this.modal(`<div class="modal-mark">${icon('spark')}</div><span class="eyebrow">一小片干净，一整份好心情</span><h2 id="modal-title">先洗净眼前这一小片。</h2><p class="modal-copy">没有倒计时，也没有标准答案。<br>把单车、长椅和地砖，洗回喜欢的样子。</p><div class="control-guide"><span>${icon('mouse')}<strong>按住清洗</strong><small>左键 / 单指拖动</small></span><span>${icon('camera')}<strong>换个角度</strong><small>右键 / 双指拖动</small></span><span>${icon('focus')}<strong>近一点看</strong><small>滚轮 / 双指缩放</small></span></div><button class="primary-button" id="start-game">${resuming ? '继续清洁' : '开始清洁'} ${icon('arrow')}</button><p class="modal-footnote">声音会随操作开启，右上角可随时关闭。</p>`, { 'start-game': this.actions.start });
  }

  pause(): void {
    this.modal(`<div class="modal-mark">${icon('leaf')}</div><span class="eyebrow">休息一下也很好</span><h2 id="modal-title">庭院会在这里等你。</h2><p class="modal-copy">进度已尝试保存。回来后，<br>继续给这片小天地一点耐心。</p><button class="primary-button" id="resume-game">继续清洁 ${icon('arrow')}</button><button class="text-button" id="pause-help">查看操作指引</button>`, { 'resume-game': this.actions.dismiss, 'pause-help': this.actions.help });
  }

  confirmReset(): void {
    this.modal(`<div class="modal-mark">${icon('reset')}</div><h2 id="modal-title">再来一场小小的焕新？</h2><p class="modal-copy">这座庭院的清洁进度和用时将重新计算。</p><button class="primary-button" id="confirm-reset">重新开始 ${icon('arrow')}</button><button class="text-button" id="cancel-reset">保留进度，返回庭院</button>`, { 'confirm-reset': this.actions.restart, 'cancel-reset': this.actions.dismiss });
  }

  complete(seconds: number): void {
    const minutes = Math.floor(seconds / 60); const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.modal(`<div class="completion-art">${icon('spark')}<span>${icon('leaf')}</span></div><span class="eyebrow">COURTYARD, RENEWED.</span><h2 id="modal-title">你洗亮了这一小片世界。</h2><p class="modal-copy">单车重新闪亮，木头恢复温度。<br>也给今天的自己，留下一点好心情。</p><div class="completion-stats"><span><strong>100<small>%</small></strong><small>庭院焕新</small></span><span><strong>3<small> / 3</small></strong><small>完成小任务</small></span><span><strong>${minutes}:${remainder}</strong><small>悠闲时光</small></span></div><button class="primary-button" id="look-courtyard">欣赏我的庭院 ${icon('arrow')}</button><button class="text-button" id="play-again">再洗一次</button>`, { 'look-courtyard': this.actions.look, 'play-again': this.actions.restart });
  }

  close(): void { if (this.dialog.open) this.dialog.close(); }
  dispose(): void { this.cleanup.abort(); clearTimeout(this.toastTimer); this.close(); }
}
