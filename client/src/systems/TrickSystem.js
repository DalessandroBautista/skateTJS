/**
 * TrickSystem.js
 * 
 * SYSTEM (lógica que opera sobre componentes).
 * 
 * Detecta secuencias de input del jugador mientras está en el aire
 * y activa el trick correspondiente.
 * 
 * Flujo: InputManager → TrickSystem → TrickStateComponent (trick activo)
 * 
 * También se conecta con ComboSystem para encadenar combos.
 */
import { TrickById } from '../tricks/TrickLibrary.js';

export class TrickSystem {
  /**
   * @param {Object} options
   * @param {import('../input/InputManager.js').InputManager} options.inputManager
   * @param {import('../components/TrickStateComponent.js').TrickStateComponent} options.trickState
   */
  constructor({ inputManager, trickState, user = null }) {
    this.input = inputManager;
    this.trickState = trickState;
    this._user = user; // referencia viva — se muta cuando el usuario sube de nivel

    /** @type {string[]} Buffer de inputs recientes para detectar secuencias */
    this._inputBuffer = [];

    /** @type {number} Tiempo máximo entre inputs para considerar la misma secuencia */
    this._inputTimeout = 0.5; // segundos

    /** @type {number} Último timestamp de input */
    this._lastInputTime = 0;

    /**
     * Trick actualmente ejecutándose (si hay).
     * @type {{ id: string, name: string, points: number } | null}
     */
    this.currentTrick = null;

    /**
     * Callback cuando un trick es ejecutado.
     * Lo usa ComboSystem para trackear el combo.
     * @type {(trick: { id: string, name: string, points: number }) => void}
     */
    this.onTrickExecuted = null;
  }

  /**
   * @param {number} dt - Delta time en segundos
   */
  update(dt) {
    const state = this.trickState.state;

    if (state === 'airborne') {
      this._detectAerialInput();
    } else {
      // Aterrizamos: ejecutar el trick pendiente si hay uno
      if (this.currentTrick) {
        this._executeTrick(this.currentTrick);
        this.currentTrick = null;
      }
      this._inputBuffer = [];
    }

    // Limpiar buffer si pasó demasiado tiempo entre inputs
    if (this._inputBuffer.length > 0 && (performance.now() - this._lastInputTime) > this._inputTimeout * 1000) {
      this._inputBuffer = [];
    }
  }

  _detectAerialInput() {
    if (this.input.isKeyPressed('Digit1') || this.input.isKeyPressed('Numpad1')) this._addInput('trick1');
    if (this.input.isKeyPressed('Digit2') || this.input.isKeyPressed('Numpad2')) this._addInput('trick2');
    if (this.input.isKeyPressed('KeyQ')   || this.input.isKeyPressed('Digit3'))   this._addInput('trick3');
    if (this.input.isKeyPressed('KeyE')   || this.input.isKeyPressed('Digit4'))   this._addInput('trick4');
  }

  _addInput(input) {
    this._inputBuffer.push(input);
    this._lastInputTime = performance.now();

    const matchedTrick = this._findMatchingTrick();

    if (matchedTrick) {
      // Guardar el trick; se contará al aterrizar (como Tony Hawk)
      this.currentTrick = matchedTrick;
      this.trickState.lastTrick = matchedTrick; // para partículas al aterrizar
      this._inputBuffer = [];
      console.log(`[Trick] ${matchedTrick.name} detectado en el aire!`);
    }
  }

  _findMatchingTrick() {
    if (this._inputBuffer.length === 0) return null;

    const seq = this._inputBuffer.join(',');
    const playerLevel = this._user?.level ?? 99;

    for (const trick of TrickById.values()) {
      if (trick.type === 'grind' || trick.type === 'manual') continue;
      if (trick.requiredLevel > playerLevel) continue;

      const trickSeq = trick.inputSequence.join(',');
      if (trickSeq === seq) {
        return { id: trick.id, name: trick.name, points: trick.points };
      }
    }

    return null;
  }

  _executeTrick(trick) {
    console.log(`[Trick] ${trick.name} — ${trick.points} pts ¡aterrizó!`);
    if (this.onTrickExecuted) {
      this.onTrickExecuted(trick);
    }
  }
}
