/**
 * Coins.js
 *
 * Monedas coleccionables repartidas por el mapa. Dan puntos al combo y
 * fomentan recorrer el skatepark usando rails y rampas.
 * Mismo patrón que SkateLetters: detección por radio + callback al recoger.
 */
import * as THREE from 'three';

const COLLECT_RADIUS = 1.8;
const COIN_VALUE = 50;

// Posiciones por mapa. Plaza (GLTF): piso real X∈[-10.9,10.1] Z∈[-17.5,15.8],
// FLOOR_Y≈3.3 → el jugador descansa a y≈3.7. Mezcla de monedas a ras (recorrer)
// y elevadas sobre rampas/rails (requieren ollie o usar los obstáculos).
const POSITIONS = {
  plaza: [
    new THREE.Vector3(-6, 4.7, 3),    // fin del rail izquierdo
    new THREE.Vector3( 6, 4.7, 3),    // fin del rail derecho
    new THREE.Vector3( 0, 4.4, 2),    // centro
    new THREE.Vector3(-3, 4.4, 9),
    new THREE.Vector3( 3, 4.4, 9),
    new THREE.Vector3(-7, 5.8, -14),  // salida de la rampa esquina izq
    new THREE.Vector3( 7, 5.8, -14),  // salida de la rampa esquina der
    new THREE.Vector3( 0, 6.0, 12),   // cima de la rampa frontal
    new THREE.Vector3(-9, 4.4, -4),
    new THREE.Vector3( 9, 4.4, -4),
  ],
};

export class Coins {
  /**
   * @param {THREE.Scene} scene
   * @param {string} mapId
   */
  constructor(scene, mapId) {
    this._scene = scene;
    this._coins = [];
    this._onCollect = null; // (value:number) => void
    this._t = 0;
    this._build(mapId);
  }

  /** @param {(value:number)=>void} fn */
  onCollect(fn) { this._onCollect = fn; }

  get value() { return COIN_VALUE; }
  get remaining() { return this._coins.filter(c => !c.userData.collected).length; }

  _build(mapId) {
    const positions = POSITIONS[mapId] ?? POSITIONS.plaza;
    const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 18);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcc00, emissive: 0xff8800, emissiveIntensity: 0.45,
      metalness: 0.85, roughness: 0.25,
    });
    for (const pos of positions) {
      const coin = new THREE.Mesh(geo, mat);
      coin.position.copy(pos);
      coin.rotation.x = Math.PI / 2; // la cara mira hacia afuera (vertical)
      coin.castShadow = true;
      coin.userData.baseY = pos.y;
      coin.userData.collected = false;
      this._scene.add(coin);
      this._coins.push(coin);
    }
  }

  update(dt, playerPos) {
    this._t += dt;
    for (const coin of this._coins) {
      if (coin.userData.collected) continue;
      coin.rotation.z += dt * 2.5; // girar sobre su eje
      coin.position.y = coin.userData.baseY + Math.sin(this._t * 2 + coin.position.x) * 0.15;
      if (playerPos.distanceTo(coin.position) < COLLECT_RADIUS) {
        this._collect(coin);
      }
    }
  }

  _collect(coin) {
    coin.userData.collected = true;
    let s = 1;
    const anim = () => {
      s += 0.12;
      coin.scale.setScalar(Math.max(0.01, 2 - s));
      coin.position.y += 0.08;
      if (s < 2) requestAnimationFrame(anim);
      else this._scene.remove(coin);
    };
    requestAnimationFrame(anim);
    if (this._onCollect) this._onCollect(COIN_VALUE);
  }

  dispose() {
    for (const c of this._coins) this._scene.remove(c);
    this._coins = [];
  }
}
