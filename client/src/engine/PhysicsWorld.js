import * as CANNON from 'cannon-es';

/**
 * PhysicsWorld.js
 * 
 * Wrapper del mundo físico de Cannon-es.
 * Configura gravedad, materiales y contacto por defecto.
 * 
 * En sprints futuros: se agregan más materiales (metal, madera) y contactos específicos.
 */
export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World();

    // Gravedad estándar (eje Y negativo)
    this.world.gravity.set(0, -9.82, 0);

    // Configuración de solver (precisión de colisiones)
    this.world.solver.iterations = 10;
    this.world.solver.tolerance = 0.001;

    // Broadphase — SAP escala linealmente con cuerpos estáticos (mejor que O(n²) de NaiveBroadphase)
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Material por defecto y contacto
    this.defaultMaterial = new CANNON.Material('default');
    this.world.defaultContactMaterial = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      {
        friction: 0.1,    // Fricción baja para que se deslice (no ruede)
        restitution: 0.0, // Sin rebote (skater no rebotar al caer)
      }
    );
    this.world.addContactMaterial(this.world.defaultContactMaterial);

    // Acumulador para fixed timestep (Bug #5)
    this._fixedStep = 1 / 60;
    this._accumulator = 0;
    this._maxSubSteps = 3; // evita spiral of death en frames lentos
  }

  /**
   * Agrega un cuerpo al mundo físico.
   * @param {CANNON.Body} body
   */
  addBody(body) {
    this.world.addBody(body);
  }

  /**
   * Remueve un cuerpo del mundo físico.
   * @param {CANNON.Body} body
   */
  removeBody(body) {
    this.world.removeBody(body);
  }

  /**
   * Avanza la simulación física con fixed timestep + acumulador.
   * Garantiza 60Hz de física independientemente del frame rate.
   * @param {number} dt - Delta time real del frame en segundos
   */
  step(dt) {
    this._accumulator += dt;
    // Clampear acumulador: evita física inestable al volver de tab background o stutters
    const maxAccum = this._maxSubSteps * this._fixedStep;
    if (this._accumulator > maxAccum) this._accumulator = maxAccum;
    let steps = 0;
    while (this._accumulator >= this._fixedStep && steps < this._maxSubSteps) {
      this.world.step(this._fixedStep);
      this._accumulator -= this._fixedStep;
      steps++;
    }
  }
}
