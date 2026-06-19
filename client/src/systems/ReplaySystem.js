/**
 * ReplaySystem.js
 *
 * Graba posición+rotación a 10fps. Al terminar el mejor combo,
 * guarda el replay. Tecla G para ver el fantasma del mejor combo.
 */
import { SkaterModel } from '../world/SkaterModel.js';

const RECORD_INTERVAL = 0.1;   // segundos entre snapshots (10fps)
const MAX_BUFFER_SEC  = 60;    // máximo 60 segundos grabados
const MAX_FRAMES      = MAX_BUFFER_SEC / RECORD_INTERVAL; // 600 frames

export class ReplaySystem {
  /**
   * @param {THREE.Scene} scene
   * @param {Function} showPopup — fn(text) para mostrar mensaje en HUD
   */
  constructor(scene, showPopup) {
    this._scene      = scene;
    this._showPopup  = showPopup;
    this._timer      = 0;
    this._buffer     = [];         // circular buffer de snapshots
    this._bestReplay = null;       // mejor combo grabado
    this._bestScore  = 0;

    // Playback
    this._ghost        = null;
    this._isReplaying  = false;
    this._replayStart  = 0;        // timestamp real de inicio de reproducción
    this._replayOffset = 0;        // t del primer frame del replay

    this._bindKey();
  }

  /**
   * Llamar cada frame antes del render.
   * @param {number} dt
   * @param {{x,y,z}} pos
   * @param {number} rot
   */
  record(dt, pos, rot) {
    this._timer += dt;
    if (this._timer >= RECORD_INTERVAL) {
      this._timer = 0;
      this._buffer.push({ t: Date.now(), x: pos.x, y: pos.y, z: pos.z, rot });
      if (this._buffer.length > MAX_FRAMES) this._buffer.shift();
    }
  }

  /**
   * Llamar al terminar un combo. Si el score es el mejor, guarda el replay.
   * @param {number} score
   * @param {number} comboDurationSec — duración aproximada del combo (para recortar el buffer)
   */
  onComboEnd(score, comboDurationSec = 15) {
    if (score <= 0 || score <= this._bestScore) return;
    this._bestScore = score;
    // Guardar los últimos N segundos del buffer
    const framesToKeep = Math.ceil(comboDurationSec / RECORD_INTERVAL) + 20; // +2s de margen
    this._bestReplay = this._buffer.slice(-Math.min(framesToKeep, this._buffer.length));
  }

  /** Avanza la reproducción del fantasma */
  update(dt) {
    if (!this._isReplaying || !this._ghost) return;

    const elapsed = (Date.now() - this._replayStart) / 1000;
    const targetT  = this._replayOffset + elapsed * 1000;

    // Encontrar el frame más cercano al tiempo de reproducción
    let frame = this._bestReplay[this._bestReplay.length - 1];
    for (let i = 0; i < this._bestReplay.length - 1; i++) {
      if (this._bestReplay[i + 1].t > targetT) {
        // Interpolar linealmente entre frames i y i+1
        const a = this._bestReplay[i];
        const b = this._bestReplay[i + 1];
        const span = b.t - a.t;
        const t = span > 0 ? (targetT - a.t) / span : 0;
        frame = {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
          rot: a.rot + (b.rot - a.rot) * t,
        };
        break;
      }
    }

    this._ghost.position.set(frame.x, frame.y, frame.z);
    this._ghost.rotation.y = frame.rot;

    // Terminar cuando el replay completa
    const lastT = this._bestReplay[this._bestReplay.length - 1].t;
    if (targetT >= lastT) this.stopReplay();
  }

  startReplay() {
    if (!this._bestReplay || this._bestReplay.length < 2) {
      if (this._showPopup) this._showPopup('No hay replay aún — ¡completá un combo!');
      return;
    }
    if (this._isReplaying) { this.stopReplay(); return; }

    this._ghost = SkaterModel.buildGhost();
    this._scene.add(this._ghost);
    this._isReplaying  = true;
    this._replayStart  = Date.now();
    this._replayOffset = this._bestReplay[0].t;
    if (this._showPopup) this._showPopup(`Replay — mejor combo: ${this._bestScore.toLocaleString()} pts`);
  }

  stopReplay() {
    if (this._ghost) {
      this._scene.remove(this._ghost);
      this._ghost = null;
    }
    this._isReplaying = false;
  }

  _bindKey() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyG' && !e.repeat) this.startReplay();
    });
  }

  dispose() {
    this.stopReplay();
  }
}
