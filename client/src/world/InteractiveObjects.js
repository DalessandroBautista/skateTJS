import * as THREE from 'three';

/**
 * InteractiveObjects.js
 * 
 * Detecta objetos interactivos en el mapa basándose en su prefijo de nombre:
 * - rail_*  → rails para grind
 * - ramp_*  → rampas
 * - spawn_* → puntos de spawn
 * 
 * Usado por TrickSystem (grinds) y por MapLoader.
 */
export class InteractiveObjects {
  constructor() {
    /** @type {{ mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3 }[]} */
    this.rails = [];

    /** @type {{ mesh: THREE.Mesh, direction: THREE.Vector3 }[]} */
    this.ramps = [];

    /** @type {THREE.Vector3[]} */
    this.spawnPoints = [];
  }

  /**
   * Carga los objetos interactivos desde el resultado de MapLoader.build().
   * @param {{
   *   rails: { mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3 }[],
   *   ramps: { mesh: THREE.Mesh, direction: THREE.Vector3 }[],
   *   spawnPoints: THREE.Vector3[]
   * }} mapData
   */
  load(mapData) {
    this.rails = mapData.rails || [];
    this.ramps = mapData.ramps || [];
    this.spawnPoints = mapData.spawnPoints || [];
  }

  /**
   * Encuentra el rail más cercano a una posición, dentro de un radio.
   * @param {THREE.Vector3} position
   * @param {number} [radius=2]
   * @returns {{ mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3, point: THREE.Vector3, t: number } | null}
   */
  findNearestRail(position, radius = 2) {
    let closest = null;
    let closestDist = radius;

    for (const rail of this.rails) {
      const point = new THREE.Vector3();
      const t = this._projectPointOnSegment(position, rail.start, rail.end, point);
      const dist = position.distanceTo(point);

      if (dist < closestDist) {
        closestDist = dist;
        closest = { ...rail, point, t };
      }
    }

    return closest;
  }

  /**
   * Proyecta un punto sobre un segmento de línea.
   * Devuelve el parámetro t (0-1) y el punto proyectado.
   */
  _projectPointOnSegment(point, segStart, segEnd, out) {
    const segDir = new THREE.Vector3().subVectors(segEnd, segStart);
    const segLen = segDir.length();
    if (segLen < 0.001) {
      out.copy(segStart);
      return 0;
    }
    segDir.divideScalar(segLen);

    const toPoint = new THREE.Vector3().subVectors(point, segStart);
    let t = toPoint.dot(segDir) / segLen;
    t = Math.max(0, Math.min(1, t));

    out.copy(segStart).add(segDir.clone().multiplyScalar(t * segLen));
    return t;
  }

  /**
   * Devuelve el punto de spawn más cercano a una posición (o el primero).
   * @param {THREE.Vector3} [near]
   * @returns {THREE.Vector3}
   */
  getSpawnPoint(near) {
    if (this.spawnPoints.length === 0) return new THREE.Vector3(0, 1, 0);
    if (!near) return this.spawnPoints[0].clone();

    let closest = this.spawnPoints[0];
    let closestDist = near.distanceTo(closest);

    for (let i = 1; i < this.spawnPoints.length; i++) {
      const dist = near.distanceTo(this.spawnPoints[i]);
      if (dist < closestDist) {
        closest = this.spawnPoints[i];
        closestDist = dist;
      }
    }

    return closest.clone();
  }
}
