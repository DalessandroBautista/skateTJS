import * as THREE from 'three';

/**
 * VelocityComponent.js
 * 
 * COMPONENTE (solo datos, sin lógica de juego).
 * 
 * Almacena la velocidad lineal y angular de una entidad.
 * Usado por PhysicsSystem para aplicar movimiento físico.
 * 
 * Convención ECS-ready: este archivo NO contiene lógica.
 * Los systems (MovementSystem, PhysicsSystem) operan sobre estos datos.
 */
export class VelocityComponent {
  /**
   * @param {Object} options
   * @param {THREE.Vector3} [options.velocity] - Velocidad lineal (unidades/segundo)
   * @param {THREE.Vector3} [options.angularVelocity] - Velocidad angular (radianes/segundo)
   */
  constructor({ velocity, angularVelocity } = {}) {
    this.velocity = velocity || new THREE.Vector3(0, 0, 0);
    this.angularVelocity = angularVelocity || new THREE.Vector3(0, 0, 0);
  }

  /**
   * Resetea las velocidades a cero.
   */
  reset() {
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
  }
}
