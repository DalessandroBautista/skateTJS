import * as THREE from 'three';

/**
 * MeshComponent.js
 * 
 * COMPONENTE (solo datos, sin lógica de juego).
 * 
 * Almacena la referencia al modelo 3D del skater y su AnimationMixer.
 * 
 * Convención ECS-ready: este archivo NO contiene lógica.
 * AnimationSystem y RenderSystem operan sobre estos datos.
 */
export class MeshComponent {
  /**
   * @param {Object} options
   * @param {THREE.Group} options.model - Grupo Three.js con el modelo
   * @param {THREE.AnimationMixer} [options.mixer] - AnimationMixer para animaciones
   * @param {Object.<string, THREE.AnimationClip>} [options.clips] - Clips de animación por nombre
   * @param {Object.<string, THREE.Object3D>} [options.bones] - Referencias a huesos/partes para animación procedural
   */
  constructor({ model, mixer, clips = {}, bones = {} } = {}) {
    this.model = model;
    this.mixer = mixer;
    this.clips = clips;
    this.bones = bones; // Para animación procedural (sin rig)
  }
}
