import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TaskId } from '../core/cleaning';
import { CleanSurface } from './surface';

const palette = { cream: 0xe3dfcd, wall: 0xeae4d0, dark: 0x34433b, yellow: 0xf6cc29, terracotta: 0xc97e59, green: 0x647b4c };
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 70);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly surfaces: CleanSurface[] = [];
  readonly occluders: THREE.Object3D[] = [];
  readonly raycaster = new THREE.Raycaster();
  private readonly materials = new Map<number, THREE.MeshStandardMaterial>();
  private readonly canvasTextures: THREE.Texture[] = [];
  private readonly pollen: THREE.Points;
  private readonly warmLight: THREE.PointLight;
  private readonly resizeObserver: ResizeObserver;
  private readonly homeTarget = vec(0, 0.65, 0);

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setClearColor(0xf3f1e7);
    this.renderer.domElement.setAttribute('aria-label', '可交互的三维清洁庭院');
    this.renderer.domElement.setAttribute('role', 'img');
    this.container.append(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0xf3f1e7, 24, 48);
    this.scene.add(new THREE.HemisphereLight(0xfffcf0, 0x829b84, 2.5));
    const sunlight = new THREE.DirectionalLight(0xffefd0, 3.6);
    sunlight.position.set(-3, 10, 6);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunlight.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: 0.5, far: 30 });
    sunlight.shadow.normalBias = 0.045;
    sunlight.shadow.bias = -0.0001;
    this.scene.add(sunlight);
    this.warmLight = new THREE.PointLight(0xffc85a, 0, 8);
    this.warmLight.position.set(0, 3, -1.5);
    this.scene.add(this.warmLight);
    this.buildCourtyard();
    const points = new Float32Array(90);
    for (let i = 0; i < points.length; i += 3) { points[i] = Math.sin(i * 3.71) * 4; points[i + 1] = 1 + (i % 9) * 0.32; points[i + 2] = Math.cos(i * 1.71) * 3; }
    this.pollen = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3)), new THREE.PointsMaterial({ color: 0xe1c66a, size: 0.035, transparent: true, opacity: 0.4, depthWrite: false }));
    this.scene.add(this.pollen);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.35;
    this.controls.minZoom = 0.7;
    this.controls.maxZoom = 2.3;
    this.controls.mouseButtons = { LEFT: null as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: null as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.resetView();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private material(color: number): THREE.MeshStandardMaterial {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    return this.materials.get(color)!;
  }

  private solid(geometry: THREE.BufferGeometry, color: number, position: THREE.Vector3): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.occluders.push(mesh);
    return mesh;
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, radius = 0.03): THREE.Mesh {
    return this.solid(new RoundedBoxGeometry(w, h, d, 2, radius), color, vec(x, y, z));
  }

  private tube(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number, cleanId?: string): THREE.Mesh {
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 12);
    let mesh: THREE.Mesh;
    if (cleanId) {
      const surface = new CleanSurface({ id: cleanId, task: 'bicycle', area: Math.PI * radius * 2 * direction.length(), width: 16, height: 48 }, geometry, Math.PI * radius * 2, direction.length(), 'yellow', true);
      this.surfaces.push(surface);
      mesh = surface.mesh;
      this.scene.add(mesh);
      this.occluders.push(mesh);
    } else mesh = this.solid(geometry, color, vec(0, 0, 0));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(vec(0, 1, 0), direction.normalize());
    return mesh;
  }

  private plane(id: string, task: TaskId, width: number, height: number, position: THREE.Vector3, horizontal: boolean, kind: 'wood' | 'stone'): void {
    const surface = new CleanSurface({ id, task, area: width * height, width: kind === 'stone' ? 96 : 64, height: kind === 'stone' ? 48 : 16 }, new THREE.PlaneGeometry(width, height), width, height, kind);
    surface.mesh.position.copy(position);
    if (horizontal) surface.mesh.rotation.x = -Math.PI / 2;
    this.surfaces.push(surface);
    this.scene.add(surface.mesh);
    this.occluders.push(surface.mesh);
  }

  private buildCourtyard(): void {
    // A floating diorama, with a broad soft contact shadow beneath it.
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 12, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(73,78,55,.24)'); gradient.addColorStop(1, 'rgba(73,78,55,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    this.canvasTextures.push(shadowTexture);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(13, 11), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.5; this.scene.add(shadow);
    this.box(0, -0.06, 0, 8.4, 0.52, 6.3, 0xc9c6af, 0.12);
    this.box(0, 0.2, 0, 8.38, 0.08, 6.28, palette.cream, 0.05);
    for (let x = -3.5; x <= 3.5; x++) for (let z = -2.5; z <= 2.5; z++) {
      this.box(x, 0.252, z, 0.965, 0.025, 0.965, (x + z) % 2 === 0 ? 0xded9c8 : 0xe4dfce, 0.012);
    }
    this.box(0, 1.05, -3.1, 8.4, 1.6, 0.16, palette.wall, 0.04);
    this.box(-4.12, 0.9, -0.8, 0.16, 1.3, 4.6, palette.wall, 0.04);
    this.box(0, 1.88, -3.1, 8.5, 0.12, 0.28, 0xd4cdb6);
    this.box(-4.12, 1.6, -0.8, 0.28, 0.12, 4.7, 0xd4cdb6);
    for (let x = -3.6; x < 3.7; x += 0.9) this.box(x, 1.06, -2.998, 0.018, 1.5, 0.012, 0xd9d2bd, 0.002);
    this.sign();
    this.buildBicycle();
    this.buildBench();
    this.plane('paving-main', 'paving', 3.6, 1.9, vec(0.2, 0.282, 1.65), true, 'stone');
    this.pot(3.25, -2.1, 1.0);
    this.pot(-3.35, 1.95, 0.58);
    this.pot(-2.7, 2.35, 0.38);
    for (let i = 0; i < 5; i++) {
      const bush = this.solid(new THREE.IcosahedronGeometry(0.37, 1), i % 2 ? 0x7d915d : palette.green, vec(-3.3 + i * 0.5, 0.6, -2.55));
      bush.scale.set(1, 0.85, 0.8);
    }
    // A stylized equipment station, without claiming to be an industrial product model.
    this.box(3.35, 0.53, 1.35, 0.62, 0.57, 0.43, palette.yellow, 0.065);
    this.box(3.35, 0.86, 1.35, 0.38, 0.15, 0.26, palette.dark);
    this.box(3.35, 0.59, 1.575, 0.4, 0.16, 0.018, palette.dark, 0.005);
    for (const x of [3.1, 3.6]) {
      const wheel = this.solid(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16), 0x343c34, vec(x, 0.35, 1.4));
      wheel.rotation.z = Math.PI / 2;
    }
    const hosePoints = [vec(3.2, 0.3, 1.6), vec(3.0, 0.3, 2.0), vec(3.2, 0.3, 2.55), vec(2.7, 0.3, 2.7), vec(2.4, 0.3, 2.2), vec(2.6, 0.3, 1.9)];
    this.solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePoints), 32, 0.026, 6, false), 0x4b554b, vec(0, 0, 0));
  }

  private buildBicycle(): void {
    const z = 0.0;
    const rear = vec(-2.7, 0.92, z), front = vec(-0.45, 0.92, z);
    for (const center of [rear, front]) {
      this.solid(new THREE.TorusGeometry(0.61, 0.056, 8, 48), 0x35443e, center);
      this.solid(new THREE.TorusGeometry(0.54, 0.015, 6, 48), 0xc4c8b9, center);
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        this.tube(center, center.clone().add(vec(Math.cos(angle) * 0.53, Math.sin(angle) * 0.53, 0)), 0.006, 0xa1aa9d);
      }
      const hub = this.solid(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), palette.dark, center); hub.rotation.x = Math.PI / 2;
    }
    const bottom = vec(-1.72, 0.89, z + 0.03), seat = vec(-2.03, 1.85, z + 0.03);
    const head = vec(-0.91, 1.83, z + 0.03), neck = vec(-0.8, 1.51, z + 0.03);
    const pairs = [[rear, seat], [rear, bottom], [bottom, seat], [seat, head], [bottom, neck], [head, neck], [neck, front]];
    pairs.forEach(([a, b], index) => this.tube(a, b, index === 6 ? 0.05 : 0.065, palette.yellow, `bicycle-frame-${index}`));
    this.tube(seat, seat.clone().add(vec(-0.06, 0.16, 0)), 0.035, palette.dark);
    this.box(-2.12, 2.05, z, 0.46, 0.105, 0.26, 0x4b4a39, 0.04);
    this.tube(head, vec(-0.93, 2.09, z), 0.027, palette.dark);
    this.tube(vec(-0.93, 2.09, -0.27), vec(-0.93, 2.09, 0.28), 0.025, palette.dark);
    this.tube(bottom, bottom.clone().add(vec(0.16, -0.13, 0.13)), 0.022, palette.dark);
    this.box(-1.53, 0.73, 0.2, 0.25, 0.055, 0.13, palette.dark);
    this.tube(bottom, vec(-1.92, 0.28, -0.2), 0.017, palette.dark);
    this.tube(rear.clone().add(vec(0, 0, -0.04)), bottom.clone().add(vec(0, 0, -0.04)), 0.018, 0x7c8476);
  }

  private buildBench(): void {
    for (const x of [0.65, 2.45]) {
      this.box(x, 0.56, -1.15, 0.1, 0.6, 0.8, palette.dark);
      this.box(x, 0.31, -1.15, 0.25, 0.08, 1.0, palette.dark);
      this.box(x, 1.11, -1.62, 0.08, 1.2, 0.08, palette.dark);
    }
    for (let i = 0; i < 4; i++) {
      const z = -1.52 + i * 0.23;
      this.box(1.55, 0.88, z, 2.65, 0.085, 0.205, 0xa67446, 0.015);
      this.plane(`bench-seat-${i}`, 'bench', 2.65, 0.205, vec(1.55, 0.924, z), true, 'wood');
    }
    for (let i = 0; i < 2; i++) {
      const y = 1.3 + i * 0.29;
      this.box(1.55, y, -1.64, 2.65, 0.24, 0.07, 0xa67446, 0.015);
      this.plane(`bench-back-${i}`, 'bench', 2.65, 0.24, vec(1.55, y, -1.603), false, 'wood');
    }
  }

  private pot(x: number, z: number, scale: number): void {
    const y = 0.28 + scale * 0.33;
    this.solid(new THREE.CylinderGeometry(scale * 0.4, scale * 0.29, scale * 0.65, 12), palette.terracotta, vec(x, y, z));
    this.solid(new THREE.TorusGeometry(scale * 0.39, scale * 0.04, 6, 24), 0xde9672, vec(x, y + scale * 0.32, z)).rotation.x = Math.PI / 2;
    this.solid(new THREE.CylinderGeometry(scale * 0.34, scale * 0.34, 0.02, 12), 0x675a40, vec(x, y + scale * 0.3, z));
    this.tube(vec(x, y, z), vec(x + 0.03, y + scale * 1.8, z), scale * 0.05, 0x8b7350);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const leaf = this.solid(new THREE.IcosahedronGeometry(scale * (scale > 0.8 ? 0.47 : 0.3), 1), [0x758954, 0x8d9b65, 0x5f7a4e][i % 3], vec(x + Math.cos(angle) * scale * 0.31, y + scale * (1.2 + i * 0.12), z + Math.sin(angle) * scale * 0.25));
      leaf.scale.y = 0.8;
    }
    if (scale < 0.8) for (let i = 0; i < 5; i++) {
      const angle = i * 2.4;
      this.solid(new THREE.SphereGeometry(scale * 0.085, 7, 5), i % 2 ? 0xe8ba7a : 0xf3e5b0, vec(x + Math.cos(angle) * scale * 0.3, y + scale * 1.8, z + Math.sin(angle) * scale * 0.3));
    }
  }

  private sign(): void {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f5f0dd'; ctx.fillRect(0, 0, 768, 256);
    ctx.fillStyle = '#4a5746'; ctx.textAlign = 'center'; ctx.font = '500 46px "Microsoft YaHei", sans-serif'; ctx.fillText('慢一点，也很好。', 384, 112);
    ctx.font = '23px sans-serif'; ctx.fillStyle = '#8c9576'; ctx.fillText('C L E A N  A  L I T T L E', 384, 170);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.canvasTextures.push(texture);
    this.box(-0.6, 1.35, -2.98, 2.85, 0.97, 0.09, 0xb5b698);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.72, 0.89), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    sign.position.set(-0.6, 1.35, -2.928); this.scene.add(sign); this.occluders.push(sign);
  }

  resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    const span = width < 700 ? 18.3 : width < 1100 ? 12.2 : 9.7;
    this.camera.left = -span * width / height / 2; this.camera.right = span * width / height / 2;
    this.camera.top = span / 2; this.camera.bottom = -span / 2;
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
  }

  resetView(): void {
    // Consume accumulated angular damping before setting the home pose.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.position.set(9, 10.5, 13);
    this.camera.zoom = 1;
    this.controls.target.copy(this.homeTarget);
    this.camera.updateProjectionMatrix(); this.controls.update();
    this.controls.enableDamping = damping;
  }

  focusTask(task: TaskId): void {
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false; this.controls.update();
    const target = task === 'bicycle' ? vec(-1.6, 1.1, 0) : task === 'bench' ? vec(1.55, 0.9, -1.2) : vec(0.2, 0.3, 1.6);
    this.camera.position.copy(target).add(vec(9, 10.5, 13));
    this.controls.target.copy(target); this.camera.zoom = containerWidth(this.container) < 700 ? 1.35 : 1.45;
    this.camera.updateProjectionMatrix(); this.controls.update();
    this.controls.enableDamping = damping;
  }

  intersect(ndc: THREE.Vector2): THREE.Intersection | undefined {
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(this.occluders, false)[0];
  }

  render(time: number, progress: number): void {
    this.controls.update(); this.pollen.rotation.y = time * 0.012;
    this.warmLight.intensity = progress * 3;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect(); this.controls.dispose();
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
    this.surfaces.forEach((s) => s.texture.dispose()); this.canvasTextures.forEach((t) => t.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

function containerWidth(element: HTMLElement): number { return element.getBoundingClientRect().width; }
