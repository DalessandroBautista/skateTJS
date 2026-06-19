/**
 * GameLoop.js
 * 
 * Loop principal del juego usando requestAnimationFrame.
 * Ejecuta los systems en orden cada frame.
 * 
 * Orden de ejecución (según diseño):
 *   1. InputManager (captura input crudo)
 *   2. MovementSystem
 *   3. PhysicsSystem
 *   4. TrickSystem
 *   5. ComboSystem
 *   6. AnimationSystem
 *   7. ProgressionSystem
 *   8. CameraSystem
 *   9. RenderSystem
 *  10. NetworkSyncSystem
 *  11. Render (Three.js)
 */
export class GameLoop {
  constructor() {
    this.systems = [];
    this.running = false;
    this._rafId = null;
    this._lastTime = 0;

    this._tick = this._tick.bind(this);
  }

  /**
   * Registra un system. El orden de registro determina el orden de ejecución.
   * @param {Object} system - Debe tener un método update(deltaTime)
   */
  addSystem(system) {
    this.systems.push(system);
  }

  /**
   * Registra el callback de render (se ejecuta al final, después de los systems).
   * @param {Function} renderFn - Función de renderizado
   */
  setRenderFunction(renderFn) {
    this._renderFn = renderFn;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop() {
    this.running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick() {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;

    // Ejecutar todos los systems en orden (con try-catch para no matar el loop)
    for (let i = 0; i < this.systems.length; i++) {
      try {
        this.systems[i].update(deltaTime);
      } catch (err) {
        console.error(`[GameLoop] Error en system #${i}:`, err);
      }
    }

    // Render
    try {
      if (this._renderFn) {
        this._renderFn();
      }
    } catch (err) {
      console.error('[GameLoop] Error en render:', err);
    }

    this._rafId = requestAnimationFrame(this._tick);
  }
}
