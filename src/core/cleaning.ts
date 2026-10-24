export const COMPLETION_THRESHOLD = 0.92;
export const TASKS = [
  { id: 'bicycle', name: '单车车架', subtitle: '让黄色重新闪亮', icon: 'bike' },
  { id: 'bench', name: '木质长椅', subtitle: '找回木头的温度', icon: 'bench' },
  { id: 'paving', name: '庭院地砖', subtitle: '洗出脚下的好风景', icon: 'tiles' },
  { id: 'window-left', name: '左侧玻璃', subtitle: '收走水迹', icon: 'window' },
  { id: 'window-center', name: '中央玻璃', subtitle: '让晴天透进来', icon: 'window' },
  { id: 'window-right', name: '右侧玻璃', subtitle: '找回清晰的风景', icon: 'window' },
  { id: 'stove', name: '油污灶台', subtitle: '带走烹饪后的油污', icon: 'steam' },
  { id: 'backsplash', name: '瓷砖背墙', subtitle: '洗净每一道缝隙', icon: 'tiles' },
  { id: 'kitchen-floor', name: '厨房地砖', subtitle: '恢复清爽', icon: 'tiles' },
  { id: 'sofa', name: '布艺沙发', subtitle: '喷洒并抽走污水', icon: 'sofa' },
  { id: 'cushion', name: '柔软靠垫', subtitle: '照顾每一个角落', icon: 'sofa' },
  { id: 'rug', name: '客厅地毯', subtitle: '洗出织物原色', icon: 'tiles' },
] as const;
export type TaskId = (typeof TASKS)[number]['id'];

/** Remaining dirt, not a synthetic progress counter. Each cell ranges from 0 to 255. */
export class DirtGrid {
  readonly data: Uint8Array;
  private remaining: number;

  constructor(readonly width: number, readonly height: number, saved?: readonly number[]) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 4 || width > 128 || height > 128) {
      throw new Error('Invalid dirt grid dimensions');
    }
    const valid = saved?.length === width * height && saved.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
    this.data = valid ? Uint8Array.from(saved!) : new Uint8Array(width * height).fill(255);
    this.remaining = this.data.reduce((sum, value) => sum + value, 0);
  }

  get progress(): number { return 1 - this.remaining / (this.data.length * 255); }

  stamp(u: number, v: number, ru: number, rv: number, seconds: number, strength = 4): number {
    if (![u, v, ru, rv, seconds, strength].every(Number.isFinite) || u < 0 || u > 1 || v < 0 || v > 1 || ru <= 0 || rv <= 0 || seconds <= 0 || strength <= 0) return 0;
    const minX = Math.max(0, Math.floor((u - ru) * this.width));
    const maxX = Math.min(this.width - 1, Math.ceil((u + ru) * this.width));
    const minY = Math.max(0, Math.floor((v - rv) * this.height));
    const maxY = Math.min(this.height - 1, Math.ceil((v + rv) * this.height));
    let removed = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = (((x + 0.5) / this.width - u) / ru) ** 2 + (((y + 0.5) / this.height - v) / rv) ** 2;
        if (distance >= 1) continue;
        const index = y * this.width + x;
        const amount = Math.min(this.data[index], Math.ceil(255 * strength * Math.min(seconds, 0.05) * (1 - distance)));
        this.data[index] -= amount;
        removed += amount;
      }
    }
    this.remaining -= removed;
    return removed / (this.data.length * 255);
  }

  clear(): void { this.data.fill(0); this.remaining = 0; }
  export(): number[] { return Array.from(this.data); }
}

export interface SurfaceSpec {
  id: string;
  task: TaskId;
  area: number;
  width: number;
  height: number;
}

export class CleaningSession {
  readonly surfaces = new Map<string, { spec: SurfaceSpec; grid: DirtGrid }>();
  private finished = new Set<TaskId>();

  constructor(specs: readonly SurfaceSpec[], saved: Record<string, number[]> = {}, readonly taskIds: readonly TaskId[] = ['bicycle', 'bench', 'paving']) {
    for (const spec of specs) {
      if (!Number.isFinite(spec.area) || spec.area <= 0 || this.surfaces.has(spec.id)) throw new Error('Invalid surface specification');
      this.surfaces.set(spec.id, { spec, grid: new DirtGrid(spec.width, spec.height, saved[spec.id]) });
    }
    this.settle();
  }

  taskProgress(task: TaskId): number {
    let weight = 0;
    let cleaned = 0;
    for (const { spec, grid } of this.surfaces.values()) {
      if (spec.task !== task) continue;
      weight += spec.area;
      cleaned += spec.area * grid.progress;
    }
    return weight > 0 ? cleaned / weight : 0;
  }

  get progress(): number {
    let weight = 0;
    let cleaned = 0;
    for (const { spec, grid } of this.surfaces.values()) { weight += spec.area; cleaned += spec.area * grid.progress; }
    return weight > 0 ? cleaned / weight : 0;
  }

  get completed(): boolean { return this.taskIds.length > 0 && this.taskIds.every((id) => this.finished.has(id)); }
  isFinished(task: TaskId): boolean { return this.finished.has(task); }

  settle(): TaskId[] {
    const newlyFinished: TaskId[] = [];
    for (const id of this.taskIds) {
      if (!this.finished.has(id) && this.taskProgress(id) >= COMPLETION_THRESHOLD) {
        for (const { spec, grid } of this.surfaces.values()) { if (spec.task === id) grid.clear(); }
        this.finished.add(id);
        newlyFinished.push(id);
      }
    }
    return newlyFinished;
  }

  snapshot(): Record<string, number[]> {
    return Object.fromEntries([...this.surfaces].map(([id, { grid }]) => [id, grid.export()]));
  }
}
