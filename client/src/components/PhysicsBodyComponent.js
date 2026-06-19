/**
 * PhysicsBodyComponent.js
 * 
 * COMPONENTE (solo datos, sin lógica de juego).
 * 
 * Almacena la referencia al cuerpo físico de Cannon-es.
 * Usado por PhysicsSystem para sincronizar el estado físico con TransformComponent.
 * 
 * Convención ECS-ready: este archivo NO contiene lógica.
 * PhysicsSystem opera sobre estos datos.
 */
export class PhysicsBodyComponent {
  /**
   * @param {Object} options
   * @param {import('cannon-es').Body} options.body - Referencia al cuerpo de Cannon-es
   * @param {boolean} [options.isStatic] - Si es true, el cuerpo no se mueve (suelo, paredes)
   */
  constructor({ body, isStatic = false }) {
    this.body = body;
    this.isStatic = isStatic;
  }
}
