import * as THREE from 'three';

export class Effects {
  private readonly beamPositions = new Float32Array(12 * 6);
  private readonly beamGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.beamPositions, 3));
  private readonly beam = new THREE.LineSegments(this.beamGeometry, new THREE.LineBasicMaterial({ color: 0xe1f5fc, transparent: true, opacity: 0.47, depthWrite: false }));
  private readonly positions = new Float32Array(180 * 3).fill(-100);
  private readonly velocities = new Float32Array(180 * 3);
  private readonly life = new Float32Array(180);
  private readonly geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
  private readonly particles = new THREE.Points(this.geometry, new THREE.PointsMaterial({ color: 0xe5f7f9, size: 0.04, transparent: true, opacity: 0.8, depthWrite: false }));
  private readonly ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 40), new THREE.MeshBasicMaterial({ color: 0xf8f9de, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  private index = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.beam.frustumCulled = this.particles.frustumCulled = false;
    this.ring.visible = this.beam.visible = false;
    scene.add(this.beam, this.particles, this.ring);
  }

  update(dt: number, spraying: boolean, hit: THREE.Intersection | undefined, camera: THREE.Camera, radius: number, nozzle: { x: number; y: number }): void {
    this.beam.visible = spraying && !!hit;
    this.ring.visible = spraying && !!hit?.object.userData.surfaceId;
    if (spraying && hit) {
      const origin = new THREE.Vector3(nozzle.x, nozzle.y, -0.4).unproject(camera);
      for (let i = 0; i < 12; i++) {
        const spread = radius * 0.3;
        this.beamPositions.set([origin.x, origin.y, origin.z, hit.point.x + (Math.random() - 0.5) * spread, hit.point.y + (Math.random() - 0.5) * spread, hit.point.z + (Math.random() - 0.5) * spread], i * 6);
      }
      this.beamGeometry.attributes.position.needsUpdate = true;
      const normal = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld) ?? new THREE.Vector3(0, 1, 0);
      this.ring.position.copy(hit.point).addScaledVector(normal, 0.012);
      this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      this.ring.scale.setScalar(radius);
      for (let j = 0; j < 5; j++) {
        const i = this.index++ % this.life.length;
        this.positions.set([hit.point.x, hit.point.y + 0.025, hit.point.z], i * 3);
        this.velocities.set([(Math.random() - 0.5) * 1.5 + normal.x, 0.5 + Math.random() * 1.5 + normal.y * 0.4, (Math.random() - 0.5) * 1.5 + normal.z], i * 3);
        this.life[i] = 0.18 + Math.random() * 0.3;
      }
    }
    for (let i = 0; i < this.life.length; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.positions[i * 3 + 1] = -100; continue; }
      this.velocities[i * 3 + 1] -= dt * 4;
      for (let c = 0; c < 3; c++) this.positions[i * 3 + c] += this.velocities[i * 3 + c] * dt;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    for (const object of [this.beam, this.particles, this.ring]) { this.scene.remove(object); object.geometry.dispose(); object.material.dispose(); }
  }
}
