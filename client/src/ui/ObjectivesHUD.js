/**
 * ObjectivesHUD.js
 *
 * Panel de objetivos de sesión (esquina superior derecha) + estado S-K-A-T-E.
 * Se actualiza llamando a refresh(missions, lettersState).
 */
export class ObjectivesHUD {
  constructor() {
    this._container = null;
    this._skateEl = null;
    this._missionsEl = null;
    this._build();
  }

  _build() {
    this._container = document.createElement('div');
    this._container.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      font-family: 'Arial Black', Arial, sans-serif;
      color: white; text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
      pointer-events: none; z-index: 10; text-align: right;
    `;

    // Letras S-K-A-T-E
    this._skateEl = document.createElement('div');
    this._skateEl.style.cssText = `
      font-size: 26px; font-weight: bold; letter-spacing: 6px;
      margin-bottom: 10px;
    `;
    this._container.appendChild(this._skateEl);

    // Misiones
    this._missionsEl = document.createElement('div');
    this._missionsEl.style.cssText = `
      font-size: 12px; line-height: 1.9; color: rgba(255,255,255,0.85);
    `;
    this._container.appendChild(this._missionsEl);

    document.body.appendChild(this._container);
    this.refresh([], new Array(5).fill(false));
  }

  /**
   * @param {Array<{text: string, progress: number, target: number, done: boolean}>} missions
   * @param {boolean[]} lettersState - 5 booleanos (S,K,A,T,E)
   */
  refresh(missions, lettersState) {
    // S-K-A-T-E
    const letterColors = [0xff4444, 0xff8800, 0xffdd00, 0x44ff88, 0x44aaff];
    const letters = ['S', 'K', 'A', 'T', 'E'];
    this._skateEl.innerHTML = letters.map((l, i) => {
      const col = '#' + letterColors[i].toString(16).padStart(6, '0');
      const opacity = lettersState[i] ? '1' : '0.25';
      return `<span style="color:${col}; opacity:${opacity}; text-shadow: 0 0 8px ${col};">${l}</span>`;
    }).join('');

    // Misiones
    this._missionsEl.innerHTML = missions.map(m => {
      const done = m.done;
      const progressText = this._progressText(m);
      const icon = done ? '✅' : '⬜';
      const style = done ? 'text-decoration: line-through; opacity: 0.5;' : '';
      return `<div style="${style}">${icon} ${m.text} ${progressText}</div>`;
    }).join('');
  }

  _progressText(m) {
    if (m.done) return '';
    const p = Math.floor(m.progress || 0);
    const t = m.target;
    if (m.type === 'speed') return `(${Math.round(p * 3.6)}/${Math.round(t * 3.6)} km/h)`;
    if (m.type === 'combo' || m.type === 'total_score') return `(${p}/${t})`;
    if (m.type === 'manual') return `(${p.toFixed(1)}/${t}s)`;
    return `(${p}/${t})`;
  }

  destroy() {
    document.body.removeChild(this._container);
  }
}
