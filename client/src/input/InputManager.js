/**
 * InputManager.js
 * 
 * Captura el estado crudo del teclado y gamepad.
 * SOLO captura input — NO contiene lógica de juego.
 * 
 * Los systems (MovementSystem, TrickSystem) leen este estado
 * para decidir qué hacer.
 * 
 * Uso:
 *   const input = new InputManager();
 *   // En un system:
 *   if (input.isKeyDown('KeyW')) { ... }
 *   const axis = input.getMovementAxis(); // { x, z } normalizado
 */
// Mapa de botones de gamepad estándar (Xbox/PS) a códigos de tecla
const GAMEPAD_BUTTON_MAP = [
  [0, 'Space'],    // A / Cross  → saltar
  [1, 'KeyR'],     // B / Circle → respawn
  [2, 'Digit1'],   // X / Square → trick1 (kickflip)
  [3, 'Digit2'],   // Y / Triangle → trick2 (heelflip)
  [4, 'KeyQ'],     // LB / L1    → trick3 (grabs)
  [5, 'KeyE'],     // RB / R1    → trick4 (nose grab)
  [8, 'KeyL'],     // Select/Back → logros
  [9, 'KeyT'],     // Start      → chat
];

const GAMEPAD_DEADZONE = 0.15;

export class InputManager {
  constructor() {
    /** @type {Set<string>} Teclas actualmente presionadas (event.code) */
    this._keysDown = new Set();

    /** @type {Set<string>} Teclas presionadas este frame (se limpian en update) */
    this._keysPressed = new Set();

    /** @type {Set<string>} Buffer de teclas presionadas desde el último update */
    this._keysPressedBuffer = new Set();

    /** @type {Set<string>} Botones de gamepad actualmente presionados (para detectar rising edge) */
    this._gamepadDown = new Set();

    /** @type {{ x: number, z: number }} Eje analógico del gamepad (stick izquierdo) */
    this._gamepadAxis = { x: 0, z: 0 };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Llama a esto una vez por frame ANTES de los systems.
   * Copia el buffer de teclas presionadas y lo limpia. También lee el gamepad.
   */
  update() {
    this._keysPressed = new Set(this._keysPressedBuffer);
    this._keysPressedBuffer.clear();
    this._pollGamepad();
  }

  _pollGamepad() {
    const gamepads = navigator.getGamepads?.() ?? [];
    let found = false;
    for (const gp of gamepads) {
      if (!gp) continue;
      found = true;

      // Botones → teclas sintéticas
      for (const [btnIndex, code] of GAMEPAD_BUTTON_MAP) {
        const pressed = gp.buttons[btnIndex]?.pressed ?? false;
        const wasDown = this._gamepadDown.has(code);
        if (pressed && !wasDown) {
          this._keysPressedBuffer.add(code);
          this._keysDown.add(code);
          this._gamepadDown.add(code);
        } else if (!pressed && wasDown) {
          this._keysDown.delete(code);
          this._gamepadDown.delete(code);
        }
      }

      // Stick izquierdo → eje de movimiento analógico
      const lx = Math.abs(gp.axes[0]) > GAMEPAD_DEADZONE ? gp.axes[0] : 0;
      const ly = Math.abs(gp.axes[1]) > GAMEPAD_DEADZONE ? gp.axes[1] : 0;
      this._gamepadAxis = { x: lx, z: ly };

      break; // usar primer gamepad conectado
    }
    if (!found) this._gamepadAxis = { x: 0, z: 0 };
  }

  /**
   * ¿Está la tecla presionada (mantenida)?
   * @param {string} code - event.code (ej: 'KeyW', 'Space')
   */
  isKeyDown(code) {
    return this._keysDown.has(code);
  }

  /**
   * ¿Se presionó la tecla este frame (single press)?
   * @param {string} code - event.code
   */
  isKeyPressed(code) {
    return this._keysPressed.has(code);
  }

  /**
   * Devuelve el vector de movimiento normalizado basado en WASD.
   * { x: izquierda/derecha, z: adelante/atrás }
   * Valores entre -1 y 1.
   */
  getMovementAxis() {
    let x = 0;
    let z = 0;

    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp'))    z -= 1;
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown'))  z += 1;
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft'))  x -= 1;
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) x += 1;

    // Mezclar con gamepad (el analógico tiene prioridad si hay input)
    const gpx = this._gamepadAxis.x;
    const gpz = this._gamepadAxis.z;
    if (Math.abs(gpx) > Math.abs(x)) x = gpx;
    if (Math.abs(gpz) > Math.abs(z)) z = gpz;

    const length = Math.sqrt(x * x + z * z);
    if (length > 1) { x /= length; z /= length; }

    return { x, z };
  }

  /** ¿Hay algún gamepad conectado y activo? */
  hasGamepad() {
    return this._gamepadAxis.x !== 0 || this._gamepadAxis.z !== 0 || this._gamepadDown.size > 0;
  }

  /** Devuelve true si el foco está en un campo de texto (chat, inputs, etc.) */
  static isTyping() {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  }

  _onKeyDown(event) {
    if (InputManager.isTyping()) return;
    if (!event.repeat) {
      this._keysPressedBuffer.add(event.code);
    }
    this._keysDown.add(event.code);
  }

  _onKeyUp(event) {
    if (InputManager.isTyping()) return;
    this._keysDown.delete(event.code);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
