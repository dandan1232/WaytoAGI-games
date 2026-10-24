import { clampDevice } from "../core/device";
import type { DevicePosition } from "../core/device";

export type DeviceGesture = {
  phase: "start" | "move" | "end";
  x: number;
  y: number;
};

export class DraggableDevice {
  private readonly cleanup = new AbortController();
  private readonly observer: ResizeObserver;
  private pointerId: number | null = null;
  private keyboardActive = false;
  private grab = { x: 0, y: 0 };
  private position = { x: 0, y: 0 };
  private viewport = { width: 0, height: 0 };
  private size = { width: 0, height: 0 };
  readonly origin = { x: 0.6, y: -0.5 };
  private workingPoint = { x: 0, y: 0 };

  constructor(
    private readonly element: HTMLElement,
    private readonly gesture: (event: DeviceGesture) => void,
  ) {
    const button = element.querySelector<HTMLButtonElement>("#device-handle")!;
    const options = { signal: this.cleanup.signal };
    button.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;
        if (this.pointerId !== null) {
          this.stop();
          return;
        }
        event.preventDefault();
        const rect = element.getBoundingClientRect();
        this.grab = { x: event.clientX - rect.x, y: event.clientY - rect.y };
        this.pointerId = event.pointerId;
        button.setPointerCapture(event.pointerId);
        this.workingPoint = { x: event.clientX, y: event.clientY };
        element.classList.add("dragging");
        this.emit("start");
      },
      options,
    );
    button.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== this.pointerId) return;
        this.place({
          x: event.clientX - this.grab.x,
          y: event.clientY - this.grab.y,
        });
        this.workingPoint = { x: event.clientX, y: event.clientY };
        this.emit("move");
      },
      options,
    );
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(type, () => this.stop(), options);
    button.addEventListener(
      "keydown",
      (event) => {
        const direction: Record<string, DevicePosition> = {
          ArrowLeft: { x: -1, y: 0 },
          ArrowRight: { x: 1, y: 0 },
          ArrowUp: { x: 0, y: -1 },
          ArrowDown: { x: 0, y: 1 },
        };
        if (direction[event.key]) {
          event.preventDefault();
          const step = event.shiftKey ? 24 : 10;
          this.place({
            x: this.position.x + direction[event.key].x * step,
            y: this.position.y + direction[event.key].y * step,
          });
          this.emit("move");
        }
        if (event.code === "Space") {
          event.preventDefault();
          if (!this.keyboardActive) {
            this.keyboardActive = true;
            this.emit("start");
          }
        }
      },
      options,
    );
    button.addEventListener(
      "keyup",
      (event) => {
        if (event.code === "Space") {
          event.preventDefault();
          this.stop();
        }
      },
      options,
    );
    button.addEventListener("blur", () => this.stop(), options);
    const resize = () => {
      if (!element.isConnected) {
        this.observer.disconnect();
        return;
      }
      const parent = element.parentElement!.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const first = !this.viewport.width;
      this.viewport = { width: parent.width, height: parent.height };
      this.size = { width: rect.width, height: rect.height };
      if (first) this.dock();
      else this.place(this.position);
    };
    this.observer = new ResizeObserver(resize);
    this.observer.observe(element);
    this.observer.observe(element.parentElement!);
    resize();
  }

  private place(position: DevicePosition): void {
    this.position = clampDevice(position, this.viewport, this.size);
    this.element.style.left = `${this.position.x}px`;
    this.element.style.top = `${this.position.y}px`;
    // Keyboard cleaning aims in front of the tool; pointer dragging aims at the pointer.
    this.workingPoint = {
      x: this.position.x - 18,
      y: this.position.y + this.size.height * 0.27,
    };
    const mode = this.element.dataset.mode;
    const head = mode === 'squeegee' ? { x: 0.5, y: 0.12 }
      : mode === 'steam' ? { x: 0.25, y: 0.58 }
      : mode === 'extraction' ? { x: 0.78, y: 0.56 }
      : { x: 0.17, y: 0.17 };
    this.origin.x =
      ((this.position.x + this.size.width * head.x) / this.viewport.width) * 2 -
      1;
    this.origin.y =
      1 -
      ((this.position.y + this.size.height * head.y) / this.viewport.height) * 2;
  }
  private emit(phase: DeviceGesture["phase"]): void {
    this.gesture({ phase, ...this.workingPoint });
  }
  dock(): void {
    this.stop();
    this.place({
      x: this.viewport.width - this.size.width - 35,
      y: this.viewport.height - this.size.height - 165,
    });
  }
  stop(): void {
    const active = this.pointerId !== null || this.keyboardActive;
    const pointerId = this.pointerId;
    this.pointerId = null;
    this.keyboardActive = false;
    this.element.classList.remove("dragging");
    const button =
      this.element.querySelector<HTMLButtonElement>("#device-handle")!;
    if (pointerId !== null && button.hasPointerCapture(pointerId))
      button.releasePointerCapture(pointerId);
    if (active) this.emit("end");
  }
  snapshot(): DevicePosition {
    return { ...this.position };
  }
  dispose(): void {
    this.stop();
    this.observer.disconnect();
    this.cleanup.abort();
  }
}
