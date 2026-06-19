import * as CANNON from 'cannon-es'; // usado para Body.DYNAMIC / Body.KINEMATIC

/**
 * PhysicsSystem.js
 * 
 * SYSTEM (lógica que opera sobre componentes).
 * 
 * Sincroniza el mundo físico de Cannon-es con los TransformComponents.
 * 
 * Flujo:
 *   1. Avanza la simulación física (world.step)
 *   2. Para cuerpos dinámicos: Cannon body → TransformComponent
 *   3. Para cuerpos kinemáticos: TransformComponent → Cannon body
 * 
 * En Sprint 1.3: el cubo es dinámico (cae por gravedad), el suelo es estático.
 * En Sprint 1.4+: el jugador será dinámico (controlado por fuerzas aplicadas).
 */
export class PhysicsSystem {
  /**
   * @param {Object} options
   * @param {import('../engine/PhysicsWorld.js').PhysicsWorld} options.physicsWorld
   */
  constructor({ physicsWorld }) {
    this.physicsWorld = physicsWorld;

    /**
     * Array de entidades con física.
     * @type {Array<{
     *   transform: import('../components/TransformComponent.js').TransformComponent,
     *   physics: import('../components/PhysicsBodyComponent.js').PhysicsBodyComponent,
     *   velocity?: import('../components/VelocityComponent.js').VelocityComponent
     * }>}
     */
    this.entities = [];
  }

  /**
   * Registra una entidad para sincronizar.
   * @param {import('../components/TransformComponent.js').TransformComponent} transform
   * @param {import('../components/PhysicsBodyComponent.js').PhysicsBodyComponent} physics
   * @param {import('../components/VelocityComponent.js').VelocityComponent} [velocity]
   */
  register(transform, physics, velocity) {
    this.entities.push({ transform, physics, velocity });
  }

  /**
   * @param {number} dt - Delta time en segundos
   */
  update(dt) {
    // 1. Avanzar la simulación física
    this.physicsWorld.step(dt);

    // 2. Sincronizar cuerpos → transforms
    for (let i = 0; i < this.entities.length; i++) {
      const { transform, physics, velocity } = this.entities[i];
      const body = physics.body;

      // Cuerpos estáticos no se sincronizan (no se mueven)
      if (physics.isStatic) continue;

      // Cuerpos dinámicos: Cannon → Transform
      if (body.type === CANNON.Body.DYNAMIC) {
        // Sincronizar posición
        transform.position.set(body.position.x, body.position.y, body.position.z);
        
        // La rotación del body de Cannon está bloqueada con angularFactor(0,0,0).
        // La rotación Y la controla MovementSystem, X y Z se mantienen en 0.

        // Actualizar VelocityComponent si existe
        if (velocity) {
          velocity.velocity.set(body.velocity.x, body.velocity.y, body.velocity.z);
          velocity.angularVelocity.set(
            body.angularVelocity.x,
            body.angularVelocity.y,
            body.angularVelocity.z
          );
        }
      }
      // Cuerpos kinemáticos: Transform → Cannon (para Sprint 1.4+)
      else if (body.type === CANNON.Body.KINEMATIC) {
        body.position.set(transform.position.x, transform.position.y, transform.position.z);
        body.quaternion.set(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w || 1
        );
      }
    }
  }
}
