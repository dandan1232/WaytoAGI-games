import { TASKS } from "../core/cleaning";
import type { CleaningSession, TaskId } from "../core/cleaning";
import { LEVELS, getLevel } from "../core/levels";
import type { Level, LevelId } from "../core/levels";
import type { Preferences } from "../core/preferences";
import { icon } from "./icons";
import {
  EQUIPMENT,
  KHB_FOLDED_IMAGE,
  equipmentDetail,
  equipmentLibrary,
} from "./equipment";
import { DraggableDevice } from "./device";
import type { DeviceGesture } from "./device";

export interface Actions {
  start: () => void;
  help: () => void;
  pause: () => void;
  dismiss: () => void;
  sound: () => void;
  settings: () => void;
  setting: (
    key: "night" | "volume" | "motion",
    value: boolean | number,
  ) => void;
  nozzle: (mode: "wide" | "detail") => void;
  resetView: () => void;
  resetPrompt: () => void;
  restart: () => void;
  look: () => void;
  focus: (task: TaskId) => void;
  equipment: () => void;
  level: (level: LevelId) => void;
  device: (event: DeviceGesture) => void;
}

export class Interface {
  readonly scene: HTMLElement;
  readonly dialog: HTMLDialogElement;
  readonly device: DraggableDevice;
  private readonly cleanup = new AbortController();
  private toastTimer = 0;
  private level: Level;
  private lastTarget: TaskId | undefined | null = null;
  private spraying = false;

  constructor(
    readonly root: HTMLElement,
    private readonly actions: Actions,
    initialLevel: Level,
  ) {
    this.level = initialLevel;
    root.innerHTML = `
      <div class="scene" id="scene"></div>
      <header class="header">
        <a class="brand" href="./" aria-label="清洁小世界首页"><span class="brand-symbol">${icon("water")}</span><span><strong>清洁小世界<span class="brand-period">.</span></strong><small>A LITTLE CLEAN, A LOT OF JOY</small></span></a>
        <nav class="header-actions" aria-label="游戏设置">
          <button class="icon-button" id="help" title="操作指引" aria-label="操作指引">${icon("help")}</button>
          <button class="icon-button" id="sound" title="关闭音效" aria-label="关闭音效" aria-pressed="false">${icon("sound")}</button>
          <button class="icon-button" id="settings" title="设置" aria-label="设置">${icon("settings")}</button>
          <button class="icon-button pause-button" id="pause" title="暂停游戏" aria-label="暂停游戏">${icon("pause")}</button>
        </nav>
      </header>
      <section class="mission-panel" aria-label="当前场景与清洁任务">
        <div class="scene-heading"><span id="scene-number">01</span><div><small>今天，洗点什么？</small><h1 id="scene-title"></h1></div><div class="progress-number"><span id="total-progress" data-testid="total-progress">0</span><small>%</small></div></div>
        <div class="overall-track"><span id="overall-bar"></span></div>
        <div class="task-list" id="task-list"></div>
      </section>
      <nav class="view-tools" aria-label="清洁与视角工具">
        <button class="icon-button active" id="nozzle-wide" aria-label="广角清洗" aria-pressed="true" title="宽幅清洁 · 1">${icon("water")}</button>
        <button class="icon-button" id="nozzle-detail" aria-label="集中点喷" aria-pressed="false" title="细节清洁 · 2">${icon("focus")}</button>
        <span class="tool-separator"></span>
        <button class="icon-button" id="reset-view" aria-label="复位视角" title="复位视角 · R">${icon("camera")}</button>
        <button class="icon-button" id="dock-device" aria-label="收回机器" title="收回机器">${icon("move")}</button>
      </nav>
      <div class="target-hint" id="target-hint" aria-live="polite">拖动机器，或按住场景开始清洁</div>
      <div class="reticle" id="reticle" hidden><span></span></div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
      <div class="device-view" id="device-view">
        <span class="device-work-point" aria-hidden="true">+</span>
        <button id="device-handle" class="device-handle" aria-label="拖动清洁设备" aria-describedby="device-instruction"><img id="held-device" alt="" width="180" height="128" draggable="false"><span class="device-model" id="device-model"></span><span class="device-grip">${icon("move")} 拖我去清洁</span></button>
        <span class="sr-only" id="device-instruction">拖动机器，让准星经过污渍。也可用方向键移动，按住空格清洁。</span>
      </div>
      <nav class="scene-dock" aria-label="选择清洁场景">${LEVELS.map((level) => `<button class="scene-card" id="level-${level.id}" data-level="${level.id}" aria-label="进入${level.name}" aria-pressed="false" style="--scene-color:${level.color}"><span class="scene-card-photo"><img src="${EQUIPMENT.find((product) => product.id === level.product)!.image}" alt="" width="85" height="55" decoding="async"></span><span class="scene-card-label">${level.shortName}<span class="level-check">${icon("check")}</span></span><small>${level.model}</small></button>`).join("")}</nav>
      <button class="equipment-link" id="equipment" aria-label="查看卡赫装备库">KÄRCHER <span>装备图鉴 ${icon("arrow")}</span></button>
      <span class="save-status" id="save-status">进度自动保存在本机</span>
      <dialog class="modal" id="modal" aria-labelledby="modal-title"></dialog>`;
    this.scene = this.get("scene");
    this.dialog = this.get<HTMLDialogElement>("modal");
    const buttons: Record<string, () => void> = {
      help: actions.help,
      sound: actions.sound,
      settings: actions.settings,
      pause: actions.pause,
      equipment: actions.equipment,
      "reset-view": actions.resetView,
      "dock-device": () => this.device.dock(),
      "nozzle-wide": () => actions.nozzle("wide"),
      "nozzle-detail": () => actions.nozzle("detail"),
    };
    for (const [id, handler] of Object.entries(buttons))
      this.get(id).addEventListener("click", handler, {
        signal: this.cleanup.signal,
      });
    root.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const levelButton =
          target?.closest<HTMLButtonElement>("button[data-level]");
        if (levelButton) {
          actions.level(getLevel(levelButton.dataset.level as LevelId).id);
          return;
        }
        const task = target?.closest<HTMLButtonElement>("[data-task]");
        if (task) actions.focus(task.dataset.task as TaskId);
        const choice = target?.closest<HTMLButtonElement>("[data-product]");
        const product = EQUIPMENT.find(
          (item) => item.id === choice?.dataset.product,
        );
        if (product) {
          this.get("equipment-detail").innerHTML = equipmentDetail(
            product.id,
            this.level.id,
          );
          for (const button of this.dialog.querySelectorAll<HTMLButtonElement>(
            "[data-product]",
          ))
            button.setAttribute("aria-pressed", String(button === choice));
        }
        const angle = target?.closest<HTMLButtonElement>("[data-angle]");
        if (angle) {
          const image = this.get<HTMLImageElement>("equipment-hero");
          image.src =
            angle.dataset.angle === "folded"
              ? KHB_FOLDED_IMAGE
              : EQUIPMENT[0].image;
          image.alt = `卡赫 KHB AIR ${angle.dataset.angle === "folded" ? "折叠收纳" : "展开机身"}产品图`;
          for (const button of this.dialog.querySelectorAll("[data-angle]"))
            button.setAttribute("aria-pressed", String(button === angle));
        }
      },
      { signal: this.cleanup.signal },
    );
    this.dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        actions.dismiss();
      },
      { signal: this.cleanup.signal },
    );
    this.device = new DraggableDevice(this.get("device-view"), actions.device);
    this.setLevel(initialLevel);
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.root.querySelector<T>(`#${id}`)!;
  }
  get sprayOrigin(): { x: number; y: number } {
    return this.device.origin;
  }

  setLevel(level: Level): void {
    this.level = level;
    this.lastTarget = null;
    this.root.dataset.level = level.id;
    this.root.style.setProperty("--accent", level.color);
    this.get("scene-number").textContent = String(
      LEVELS.indexOf(level) + 1,
    ).padStart(2, "0");
    this.get("scene-title").textContent = level.name;
    this.get("device-model").textContent = level.model;
    const image = this.get<HTMLImageElement>("held-device");
    image.src = EQUIPMENT.find(
      (product) => product.id === level.product,
    )!.image;
    image.alt = `卡赫 ${level.model} ${level.tool}`;
    this.get("device-handle").setAttribute(
      "aria-label",
      `拖动清洁设备 ${level.model}`,
    );
    this.get("device-view").dataset.mode = level.mode;
    this.get("nozzle-wide").innerHTML = icon(
      level.mode === "squeegee"
        ? "window"
        : level.mode === "steam"
          ? "steam"
          : level.mode === "extraction"
            ? "sofa"
            : "water",
    );
    this.get("nozzle-wide").setAttribute(
      "aria-label",
      level.mode === "water" ? "广角清洗" : `宽幅${level.action}`,
    );
    this.get("nozzle-detail").setAttribute(
      "aria-label",
      level.mode === "water" ? "集中点喷" : `细节${level.action}`,
    );
    this.get("nozzle-wide").title = `宽幅${level.action} · 1`;
    this.get("nozzle-detail").title = `细节${level.action} · 2`;
    this.get("target-hint").textContent = `拖动${level.model}，让准星经过污渍`;
    this.get("task-list").innerHTML = level.tasks
      .map((id) => {
        const task = TASKS.find((task) => task.id === id)!;
        return `<button class="task" id="task-${id}" data-task="${id}" aria-label="聚焦${task.name}" title="聚焦${task.name}">${icon(task.icon)}<span>${task.name}</span><small id="percent-${id}">0%</small></button>`;
      })
      .join("");
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      ".scene-card",
    ))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.level === level.id),
      );
    this.device.dock();
  }
  update(session: CleaningSession): void {
    this.get("total-progress").textContent = String(
      Math.floor(session.progress * 100 + 0.00001),
    );
    this.get("overall-bar").style.width = `${session.progress * 100}%`;
    for (const id of this.level.tasks) {
      const complete = session.isFinished(id);
      this.get(`percent-${id}`).textContent = complete
        ? "完成"
        : `${Math.floor(session.taskProgress(id) * 100)}%`;
      this.get(`task-${id}`).dataset.complete = String(complete);
    }
    this.get(`level-${this.level.id}`).classList.toggle(
      "completed",
      session.completed,
    );
    this.root.classList.toggle("all-clean", session.completed);
  }
  setCompleted(level: LevelId, complete: boolean): void {
    this.get(`level-${level}`).classList.toggle("completed", complete);
  }
  setNozzle(mode: "wide" | "detail"): void {
    for (const nozzle of ["wide", "detail"])
      this.get(`nozzle-${nozzle}`).setAttribute(
        "aria-pressed",
        String(nozzle === mode),
      );
    this.get("reticle").classList.toggle("detail", mode === "detail");
  }
  setPreferences(preferences: Preferences): void {
    this.root.dataset.night = String(preferences.night);
    this.root.dataset.motion = String(preferences.motion);
    const button = this.get("sound");
    button.innerHTML = icon(preferences.muted ? "mute" : "sound");
    button.setAttribute(
      "aria-label",
      preferences.muted ? "开启音效" : "关闭音效",
    );
    button.setAttribute("aria-pressed", String(preferences.muted));
    this.dialog
      .querySelector("#settings-sound")
      ?.setAttribute("aria-pressed", String(!preferences.muted));
    this.dialog
      .querySelector("#setting-night")
      ?.setAttribute("aria-pressed", String(preferences.night));
    this.dialog
      .querySelector("#setting-day")
      ?.setAttribute("aria-pressed", String(!preferences.night));
    this.dialog
      .querySelector("#setting-motion")
      ?.setAttribute("aria-pressed", String(preferences.motion));
    const output = this.dialog.querySelector("output");
    if (output) output.textContent = `${preferences.volume}%`;
  }
  setSaving(ok: boolean): void {
    this.get("save-status").textContent = ok
      ? "已自动保存"
      : "本次进度暂时无法保存";
  }
  cursor(
    x: number,
    y: number,
    visible: boolean,
    spraying: boolean,
    task?: TaskId,
  ): void {
    const reticle = this.get("reticle");
    reticle.hidden = !visible;
    reticle.style.left = `${x}px`;
    reticle.style.top = `${y}px`;
    reticle.classList.toggle("spraying", spraying);
    reticle.classList.toggle("on-target", !!task);
    if (this.spraying !== spraying) {
      this.get("device-view").classList.toggle("is-spraying", spraying);
      this.spraying = spraying;
    }
    if (task !== this.lastTarget) {
      this.get("target-hint").textContent = task
        ? `${TASKS.find((item) => item.id === task)!.name} · ${this.level.action}中，把颜色找回来`
        : "拖动机器，或按住场景清洁 · 右键旋转";
      this.lastTarget = task;
    }
  }
  toast(message: string): void {
    const element = this.get("toast");
    element.textContent = message;
    element.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => element.classList.remove("visible"),
      2600,
    );
  }
  private modal(
    html: string,
    handlers: Record<string, () => void>,
    className = "",
  ): void {
    if (this.dialog.open) this.dialog.close();
    this.dialog.className = `modal ${className}`;
    this.dialog.innerHTML = html;
    for (const [id, handler] of Object.entries(handlers))
      this.get(id).addEventListener("click", handler, { once: true });
    this.dialog.showModal();
  }
  intro(resuming: boolean): void {
    const product = EQUIPMENT.find(
      (product) => product.id === this.level.product,
    )!;
    this.modal(
      `<span class="dialog-kicker">小小清洁，大大满足</span><div class="intro-art"><img src="${product.image}" alt="${product.model} ${product.name}" width="150" height="130"><span>${icon("spark")}</span></div><h2 id="modal-title">${this.level.title}</h2><p class="modal-copy">${this.level.description}</p><div class="control-guide"><span>${icon("move")}<strong>拖动机器</strong><small>拖着机器经过污渍即可清洁</small></span><span>${icon("mouse")}<strong>直接清洁</strong><small>按住左键 / 单指拖动</small></span><span>${icon("camera")}<strong>换个角度</strong><small>右键旋转 / 双指缩放</small></span></div><button class="primary-button" id="start-game">${resuming ? "继续清洁" : "开始清洁"} ${icon("arrow")}</button><p class="modal-footnote">也支持方向键移动机器，按住空格清洁。</p>`,
      { "start-game": this.actions.start },
    );
  }
  settings(preferences: Preferences): void {
    this.modal(
      `<div class="dialog-heading"><div><span class="dialog-kicker">把世界调成喜欢的样子</span><h2 id="modal-title">设置</h2></div><button class="icon-button" id="close-settings" aria-label="关闭设置">${icon("close")}</button></div>
      <div class="setting-row"><span><strong>世界的时间</strong><small>换一种光，换一种心情</small></span><div class="segmented"><button id="setting-day" aria-pressed="${!preferences.night}">${icon("sun")}白天</button><button id="setting-night" aria-pressed="${preferences.night}">${icon("moon")}夜晚</button></div></div>
      <div class="setting-row"><span><strong>清洁音效</strong><small>水流、蒸汽和完成提示</small></span><button class="switch" id="settings-sound" aria-label="清洁音效" aria-pressed="${!preferences.muted}"><span></span></button></div>
      <label class="volume-row" for="setting-volume"><span>音量 <output>${preferences.volume}%</output></span><input id="setting-volume" type="range" min="0" max="100" step="5" value="${preferences.volume}"></label>
      <div class="setting-row"><span><strong>环境动画</strong><small>关闭漂浮微粒，保留清洁反馈</small></span><button class="switch" id="setting-motion" aria-label="环境动画" aria-pressed="${preferences.motion}"><span></span></button></div>
      <div class="settings-links"><button class="secondary-button" id="settings-help">${icon("help")}操作指引</button><button class="secondary-button danger" id="reset-game">${icon("reset")}重新开始本关</button></div><button class="primary-button" id="settings-return">返回小世界 ${icon("arrow")}</button>`,
      {
        "close-settings": this.actions.dismiss,
        "settings-return": this.actions.dismiss,
        "settings-help": this.actions.help,
        "reset-game": this.actions.resetPrompt,
      },
      "settings-modal",
    );
    this.get("settings-sound").addEventListener("click", this.actions.sound);
    this.get("setting-day").addEventListener("click", () =>
      this.actions.setting("night", false),
    );
    this.get("setting-night").addEventListener("click", () =>
      this.actions.setting("night", true),
    );
    this.get("setting-motion").addEventListener("click", () =>
      this.actions.setting(
        "motion",
        this.get("setting-motion").getAttribute("aria-pressed") !== "true",
      ),
    );
    this.get<HTMLInputElement>("setting-volume").addEventListener(
      "input",
      (event) =>
        this.actions.setting(
          "volume",
          Number((event.target as HTMLInputElement).value),
        ),
    );
  }
  equipment(): void {
    this.modal(
      equipmentLibrary(this.level.id),
      {
        "close-equipment": this.actions.dismiss,
        "return-courtyard": this.actions.dismiss,
      },
      "equipment-modal",
    );
  }
  pause(): void {
    this.modal(
      `<div class="dialog-stamp">${icon("pause")}</div><h2 id="modal-title">休息一下，世界在等你。</h2><p class="modal-copy">${this.level.name}的清洁进度已尝试保存。</p><button class="primary-button" id="resume-game">继续清洁 ${icon("arrow")}</button>`,
      { "resume-game": this.actions.dismiss },
    );
  }
  confirmReset(): void {
    this.modal(
      `<div class="dialog-stamp">${icon("reset")}</div><h2 id="modal-title">重新清洁${this.level.name}？</h2><p class="modal-copy">只重置这一关的进度与用时，其他场景会保留。</p><button class="primary-button" id="confirm-reset">重新开始 ${icon("arrow")}</button><button class="text-button" id="cancel-reset">保留进度，返回场景</button>`,
      {
        "confirm-reset": this.actions.restart,
        "cancel-reset": this.actions.dismiss,
      },
    );
  }
  complete(seconds: number): void {
    const next = LEVELS[(LEVELS.indexOf(this.level) + 1) % LEVELS.length];
    this.modal(
      `<div class="dialog-stamp completion-stamp">${icon("check")}</div><span class="dialog-kicker">干净这件小事，你做到了</span><h2 id="modal-title">${this.level.name}焕新完成！</h2><p class="modal-copy">${this.level.model} 和你，洗亮了这一小片世界。</p><div class="completion-stats"><span><strong>100<small>%</small></strong>焕新进度</span><span><strong>3<small>/3</small></strong>完成任务</span><span><strong>${Math.floor(seconds / 60)}:${Math.floor(
        seconds % 60,
      )
        .toString()
        .padStart(
          2,
          "0",
        )}</strong>悠闲时光</span></div><button class="primary-button" data-level="${next.id}">去${next.name} ${icon("arrow")}</button><button class="secondary-button" id="look-courtyard">欣赏我的成果</button><button class="text-button" id="play-again">再洗一次</button>`,
      {
        "look-courtyard": this.actions.look,
        "play-again": this.actions.restart,
      },
    );
  }
  close(): void {
    if (this.dialog.open) this.dialog.close();
  }
  dispose(): void {
    this.device.dispose();
    this.cleanup.abort();
    clearTimeout(this.toastTimer);
    this.close();
  }
}
