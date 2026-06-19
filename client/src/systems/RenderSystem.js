import * as THREE from 'three';

/**
 * RenderSystem.js
 * 
 * SYSTEM (lógica que opera sobre componentes).
 * 
 * Sincroniza la posición y rotación de los meshes de Three.js
 * con sus respectivos TransformComponents.
 * 
 * Flujo: TransformComponent → RenderSystem → THREE.Mesh position/rotation
 */
export class RenderSystem {
  constructor() {
    /**
     * Array de pares { transform, mesh } para sincronizar cada frame.
     * @type {Array<{ transform: import('../components/TransformComponent.js').TransformComponent, mesh: THREE.Object3D }>}
     */
    this.entities = [];
  }

  /**
   * Registra un par transform ↔ mesh para sincronizar.
   * @param {import('../components/TransformComponent.js').TransformComponent} transform
   * @param {THREE.Object3D} mesh
   */
  register(transform, mesh) {
    this.entities.push({ transform, mesh });
  }

  /**
   * @param {number} _dt - Delta time (no usado en este system)
   */
  update(_dt) {
    for (let i = 0; i < this.entities.length; i++) {
      const { transform, mesh } = this.entities[i];

      mesh.position.copy(transform.position);
      mesh.rotation.copy(transform.rotation);
      mesh.scale.copy(transform.scale);
    }
  }
}
