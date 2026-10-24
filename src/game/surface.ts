import * as THREE from 'three';
import type { DirtGrid, SurfaceSpec } from '../core/cleaning';

export type SurfaceKind = 'yellow' | 'wood' | 'stone';
export class CleanSurface {
  readonly texture: THREE.CanvasTexture;
  readonly material: THREE.MeshStandardMaterial;
  readonly mesh: THREE.Mesh;
  grid!: DirtGrid;
  private readonly context: CanvasRenderingContext2D;
  private readonly pixels: ImageData;
  private readonly clean: Uint8ClampedArray;
  private readonly dirty: Uint8ClampedArray;

  constructor(
    readonly spec: SurfaceSpec,
    geometry: THREE.BufferGeometry,
    readonly spanU: number,
    readonly spanV: number,
    kind: SurfaceKind,
    readonly tubular = false,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    this.context = canvas.getContext('2d')!;
    this.pixels = this.context.createImageData(spec.width, spec.height);
    this.clean = new Uint8ClampedArray(spec.width * spec.height * 4);
    this.dirty = new Uint8ClampedArray(this.clean.length);
    const base = kind === 'yellow' ? [248, 204, 32] : kind === 'wood' ? [179, 122, 72] : [220, 211, 186];
    for (let y = 0; y < spec.height; y++) {
      for (let x = 0; x < spec.width; x++) {
        const i = (y * spec.width + x) * 4;
        const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453 % 1;
        const grain = kind === 'wood' ? Math.sin(y * 2.4 + Math.sin(x * 0.12) * 0.7) * 12 : noise * 5;
        const grout = kind === 'stone' && (x % 16 < 1 || y % 16 < 1);
        const mottling = Math.sin(x * 0.28) * Math.sin(y * 0.19) * 14 + noise * 14;
        for (let c = 0; c < 3; c++) {
          this.clean[i + c] = grout ? base[c] * 0.79 : base[c] + grain;
          this.dirty[i + c] = [94, 91, 63][c] + mottling + base[c] * 0.08;
        }
        this.clean[i + 3] = this.dirty[i + 3] = 255;
      }
    }
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: kind === 'yellow' ? 0.47 : 0.86 });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.surfaceId = spec.id;
  }

  bind(grid: DirtGrid): void { this.grid = grid; this.redraw(); }

  paint(uv: THREE.Vector2, radius: number, dt: number, strength: number): number {
    // Small frame tubes get circumferential coverage, avoiding inaccessible back-side specks.
    const u = this.tubular ? 0.5 : uv.x;
    const ru = this.tubular ? 1 : radius / this.spanU;
    const change = this.grid.stamp(u, 1 - uv.y, ru, radius / this.spanV, dt, strength);
    if (change > 0) this.redraw();
    return change;
  }

  redraw(): void {
    for (let i = 0; i < this.grid.data.length; i++) {
      const amount = this.grid.data[i] / 255;
      for (let c = 0; c < 3; c++) this.pixels.data[i * 4 + c] = this.clean[i * 4 + c] * (1 - amount) + this.dirty[i * 4 + c] * amount;
      this.pixels.data[i * 4 + 3] = 255;
    }
    this.context.putImageData(this.pixels, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose(): void { this.texture.dispose(); this.material.dispose(); this.mesh.geometry.dispose(); }
}
