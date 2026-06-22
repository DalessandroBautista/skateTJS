/**
 * SkateLetters.js
 *
 * Letras S-K-A-T-E flotantes por mapa.
 * Coleccionables: el jugador las recoge al acercarse (radio 2m).
 * Se resetean al cambiar de sala.
 */
import * as THREE from 'three';

const LETTERS = ['S', 'K', 'A', 'T', 'E'];
const COLORS  = [0xff4444, 0xff8800, 0xffdd00, 0x44ff88, 0x44aaff];
const COLLECT_RADIUS = 2.2;

// Posiciones por mapa — ajustadas a la geometría de cada uno
const POSITIONS = {
  // Plaza es el mapa GLTF: piso real X∈[-10.9,10.1] Z∈[-17.5,15.8], FLOOR_Y≈3.3.
  // Las letras se ubican sobre los obstáculos del skatepark (dentro del área
  // jugable), incentivando usar rails y rampas para alcanzarlas.
  plaza: [
    new THREE.Vector3(-6, 5.0, -3),   // S — sobre el rail izquierdo
    new THREE.Vector3( 6, 5.0, -3),   // K — sobre el rail derecho
    new THREE.Vector3( 0, 5.8, -11),  // A — sobre el funbox
    new THREE.Vector3( 0, 5.3,  6),   // T — sobre el rail central
    new THREE.Vector3( 0, 6.2, 13),   // E — en la cima de la rampa frontal
  ],
  park: [
    new THREE.Vector3(-18, 5,   0),
    new THREE.Vector3( 18, 5,   0),
    new THREE.Vector3(  0, 7, -18),
    new THREE.Vector3(-12, 4,  15),
    new THREE.Vector3( 12, 4,  15),
  ],
  streets: [
    new THREE.Vector3(-18, 5, -14),
    new THREE.Vector3( 18, 5, -14),
    new THREE.Vector3(  0, 7,   0),
    new THREE.Vector3(-18, 5,  14),
    new THREE.Vector3( 18, 5,  14),
  ],
};

export class SkateLetters {
  /**
   * @param {THREE.Scene} scene
   * @param {string} mapId
   */
  constructor(scene, mapId) {
    this._scene = scene;
    this._sprites = [];
    this._collected = new Array(5).fill(false);
    this._onCollect = null; // (index, letter) => void

    this._build(mapId);
  }

  /** @param {(index: number, letter: string) => void} fn */
  onCollect(fn) { this._onCollect = fn; }

  /** Cuántas letras fueron coleccionadas */
  get count() { return this._collected.filter(Boolean).length; }

  /** ¿Todas coleccionadas? */
  get complete() { return this._collected.every(Boolean); }

  /** Devuelve qué letras fueron coleccionadas (booleanos) */
  get state() { return [...this._collected]; }

  _build(mapId) {
    const positions = POSITIONS[mapId] ?? POSITIONS.plaza;
    for (let i = 0; i < 5; i++) {
      const sprite = this._makeSprite(LETTERS[i], COLORS[i]);
      sprite.position.copy(positions[i]);
      sprite.userData.letterIndex = i;
      this._scene.add(sprite);
      this._sprites.push(sprite);
    }
  }

  _makeSprite(letter, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Halo exterior
    const hex = '#' + color.toString(16).padStart(6, '0');
    ctx.shadowColor = hex;
    ctx.shadowBlur = 24;

    // Fondo semitransparente
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fill();

    // Borde de color
    ctx.strokeStyle = hex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Letra
    ctx.fillStyle = hex;
    ctx.font = 'bold 80px Arial Black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 64, 68);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.8, 1.8, 1);
    return sprite;
  }

  update(dt, playerPos) {
    for (let i = 0; i < this._sprites.length; i++) {
      if (this._collected[i]) continue;
      const sp = this._sprites[i];

      // Rotación y flotación
      sp.material.rotation += dt * 1.2;
      sp.position.y += Math.sin(Date.now() * 0.002 + i * 1.3) * dt * 0.3;

      // Detección de colección
      if (playerPos.distanceTo(sp.position) < COLLECT_RADIUS) {
        this._collect(i);
      }
    }
  }

  _collect(index) {
    this._collected[index] = true;
    const sp = this._sprites[index];

    // Animación de desvanecimiento
    let opacity = 1;
    const fade = () => {
      opacity -= 0.08;
      sp.material.opacity = Math.max(0, opacity);
      sp.scale.multiplyScalar(1.05);
      if (opacity > 0) requestAnimationFrame(fade);
      else this._scene.remove(sp);
    };
    requestAnimationFrame(fade);

    if (this._onCollect) this._onCollect(index, LETTERS[index]);
  }

  dispose() {
    for (const sp of this._sprites) {
      this._scene.remove(sp);
      sp.material.dispose();
    }
    this._sprites = [];
  }
}
