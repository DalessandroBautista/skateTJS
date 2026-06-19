/**
 * TrickStateComponent.js
 * 
 * COMPONENTE (solo datos, sin lógica de juego).
 * 
 * Almacena el estado actual del skater en relación a tricks y movimiento.
 * Usado por TrickSystem, AnimationSystem y ComboSystem.
 * 
 * Estados posibles:
 * - idle: quieto en el suelo
 * - skating: moviéndose en el suelo
 * - airborne: en el aire (saltando o cayendo)
 * - grinding: deslizándose sobre un rail
 * 
 * Convención ECS-ready: este archivo NO contiene lógica.
 * Los systems (TrickSystem, AnimationSystem) operan sobre estos datos.
 */
export class TrickStateComponent {
  /**
   * @param {Object} options
   * @param {'idle'|'skating'|'airborne'|'grinding'} [options.state] - Estado actual
   */
  constructor({ state = 'idle' } = {}) {
    this.state = state;

    // Tiempo en el estado actual (para animaciones y lógica de tricks)
    this.stateTimer = 0;

    // Flag para saber si el jugador está en el suelo (raycast)
    this.isGrounded = false;

    // Último trick ejecutado (para efectos de partículas al aterrizar)
    this.lastTrick = null;
  }

  /**
   * Cambia el estado y resetea el timer.
   * @param {'idle'|'skating'|'airborne'|'grinding'} newState
   */
  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateTimer = 0;
    }
  }
}
