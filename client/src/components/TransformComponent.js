import * as THREE from 'three';

/**
 * TransformComponent.js
 * 
 * COMPONENTE (solo datos, sin lógica de juego).
 * 
 * Almacena posición, rotación y escala de una entidad.
 * Usado por todos los systems que necesitan saber dónde está algo en el mundo.
 * 
 * Convención ECS-ready: este archivo NO contiene lógica.
 * Los systems (MovementSystem, PhysicsSystem, RenderSystem) operan sobre estos datos.
 */
export class TransformComponent {
  /**
   * @param {Object} options
   * @param {THREE.Vector3} [options.position] - Posición en el mundo
   * @param {THREE.Euler} [options.rotation] - Rotación (en radianes)
   * @param {THREE.Vector3} [options.scale] - Escala
   */
  constructor({ position, rotation, scale } = {}) {
    this.position = position || new THREE.Vector3(0, 0, 0);
    this.rotation = rotation || new THREE.Euler(0, 0, 0, 'YXZ');
    this.scale = scale || new THREE.Vector3(1, 1, 1);
  }

  /**
   * Resetea el transform a valores por defecto.
   */
  reset() {
    this.position.set(0, 0, 0);
    this.rotation.set(0, 0, 0);
    this.scale.set(1, 1, 1);
  }
}
