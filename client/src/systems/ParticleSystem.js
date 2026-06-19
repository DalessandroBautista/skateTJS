import * as THREE from 'three';

/**
 * ParticleSystem.js
 *
 * Efectos de partículas procedurales:
 * - Polvo en los pies al patinar (velocidad > 3)
 * - Destellos/chispas al aterrizar un trick
 * - Chispas de grind en el rail
 *
 * Usa un pool de partículas para evitar GC.
 */

const MAX_PARTICLES = 200;

export class ParticleSystem {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._particles = [];
    this._active = [];

    this._geometry = new THREE.BufferGeometry();
    this._positions = new Float32Array(MAX_PARTICLES * 3);
    this._colors = new Float32Array(MAX_PARTICLES * 3);
    this._sizes = new Float32Array(MAX_PARTICLES);

    this._geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    this._geometry.setAttribute('color', new THREE.BufferAttribute(this._colors, 3));
    this._geometry.setAttribute('size', new THREE.BufferAttribute(this._sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this._points = new THREE.Points(this._geometry, material);
    this._points.frustumCulled = false;
    scene.add(this._points);

    // Pre-llenar pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._particles.push({
        active: false,
        life: 0,
        maxLife: 0,
        vx: 0, vy: 0, vz: 0,
        x: 0, y: 0, z: 0,
        r: 1, g: 1, b: 1,
        baseSize: 0.15,
        index: i,
      });
    }

    this._dustTimer = 0;
  }

  /** Obtiene una partícula libre del pool */
  _getParticle() {
    return this._particles.find(p => !p.active) || null;
  }

  /**
   * Emite polvo al patinar — llamar cada frame con la velocidad actual.
   * @param {THREE.Vector3} pos - posición del skater
   * @param {number} speed - velocidad horizontal (m/s)
   */
  emitDust(pos, speed) {
    if (speed < 3) return;

    this._dustTimer += 0.016;
    const rate = Math.min(0.06, 0.15 / speed);
    if (this._dustTimer < rate) return;
    this._dustTimer = 0;

    const count = speed > 8 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) return;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.3 + Math.random() * 0.25;
      p.x = pos.x + (Math.random() - 0.5) * 0.4;
      p.y = pos.y - 0.3 + Math.random() * 0.1;
      p.z = pos.z + (Math.random() - 0.5) * 0.4;
      p.vx = (Math.random() - 0.5) * 1.5;
      p.vy = 0.5 + Math.random() * 1.0;
      p.vz = (Math.random() - 0.5) * 1.5;
      // Color: gris claro / polvo
      p.r = 0.7 + Math.random() * 0.2;
      p.g = 0.65 + Math.random() * 0.2;
      p.b = 0.6 + Math.random() * 0.2;
      p.baseSize = 0.12 + Math.random() * 0.08;
    }
  }

  /**
   * Emite chispas doradas al aterrizar un trick.
   * @param {THREE.Vector3} pos
   */
  emitTrickLand(pos) {
    const count = 20 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) return;

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.3;
      p.x = pos.x + (Math.random() - 0.5) * 0.3;
      p.y = pos.y - 0.2;
      p.z = pos.z + (Math.random() - 0.5) * 0.3;
      p.vx = Math.cos(angle) * speed;
      p.vy = 1.5 + Math.random() * 3;
      p.vz = Math.sin(angle) * speed;
      // Dorado / naranja
      p.r = 1.0;
      p.g = 0.7 + Math.random() * 0.3;
      p.b = 0.0 + Math.random() * 0.2;
      p.baseSize = 0.1 + Math.random() * 0.1;
    }
  }

  /**
   * Emite chispas metálicas de grind.
   * @param {THREE.Vector3} pos
   */
  emitGrind(pos) {
    const p = this._getParticle();
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.2 + Math.random() * 0.15;
    p.x = pos.x + (Math.random() - 0.5) * 0.2;
    p.y = pos.y - 0.3;
    p.z = pos.z + (Math.random() - 0.5) * 0.2;
    p.vx = (Math.random() - 0.5) * 3;
    p.vy = 1 + Math.random() * 2;
    p.vz = (Math.random() - 0.5) * 3;
    // Blanco / amarillo brillante
    p.r = 1.0;
    p.g = 0.9 + Math.random() * 0.1;
    p.b = 0.3 + Math.random() * 0.4;
    p.baseSize = 0.08 + Math.random() * 0.06;
  }

  /**
   * @param {number} dt - Delta time en segundos
   */
  update(dt) {
    let hasActive = false;

    for (const p of this._particles) {
      const i3 = p.index * 3;

      if (!p.active) {
        // Ocultar partícula inactiva detrás de la cámara
        this._positions[i3] = 0;
        this._positions[i3 + 1] = -1000;
        this._positions[i3 + 2] = 0;
        this._sizes[p.index] = 0;
        continue;
      }

      p.life += dt;
      const t = p.life / p.maxLife;

      if (t >= 1) {
        p.active = false;
        this._positions[i3 + 1] = -1000;
        this._sizes[p.index] = 0;
        continue;
      }

      hasActive = true;

      // Física simple: gravedad
      p.vy -= 4 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      this._positions[i3] = p.x;
      this._positions[i3 + 1] = p.y;
      this._positions[i3 + 2] = p.z;

      // Fade out en la última mitad de vida
      const fade = t > 0.5 ? 1 - (t - 0.5) * 2 : 1;
      this._colors[i3] = p.r * fade;
      this._colors[i3 + 1] = p.g * fade;
      this._colors[i3 + 2] = p.b * fade;

      // Tamaño decrece con el tiempo
      this._sizes[p.index] = p.baseSize * (1 - t * 0.5);
    }

    this._geometry.attributes.position.needsUpdate = true;
    this._geometry.attributes.color.needsUpdate = true;
    this._geometry.attributes.size.needsUpdate = true;
  }

  dispose() {
    this._scene.remove(this._points);
    this._geometry.dispose();
    this._points.material.dispose();
  }
}
