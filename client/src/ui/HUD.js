/**
 * HUD.js
 * 
 * UI en el browser (DOM overlay) que muestra en tiempo real:
 * - Score total del combo
 * - Multiplicador (×1 a ×4)
 * - Timer del combo
 * - Lista de tricks del combo actual
 * - Nivel y XP bar
 * 
 * Se actualiza cada frame desde los componentes de datos.
 */
export class HUD {
  constructor(user = null) {
    this._user = user;
    this._container = null;
    this._scoreEl = null;
    this._multiplierEl = null;
    this._timerEl = null;
    this._tricksEl = null;
    this._levelEl = null;
    this._xpBarEl = null;
    this._xpBarFillEl = null;
    this._trickPopupEl = null;
    this._trickPopupTimeout = null;
    this._prevScore = 0;

    this._build();
  }

  _build() {
    // Contenedor principal
    this._container = document.createElement('div');
    this._container.id = 'hud';
    this._container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: 'Arial Black', Arial, sans-serif;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      z-index: 10;
    `;

    // Score (esquina superior izquierda)
    this._scoreEl = document.createElement('div');
    this._scoreEl.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      font-size: 48px;
      font-weight: bold;
    `;
    this._scoreEl.textContent = '0';
    this._container.appendChild(this._scoreEl);

    // Multiplicador (al lado del score)
    this._multiplierEl = document.createElement('div');
    this._multiplierEl.style.cssText = `
      position: absolute;
      top: 75px;
      left: 20px;
      font-size: 24px;
      color: #ffcc00;
    `;
    this._multiplierEl.textContent = 'x1';
    this._container.appendChild(this._multiplierEl);

    // Timer del combo (barra horizontal debajo del score)
    this._timerEl = document.createElement('div');
    this._timerEl.style.cssText = `
      position: absolute;
      top: 110px;
      left: 20px;
      width: 200px;
      height: 6px;
      background: rgba(255,255,255,0.3);
      border-radius: 3px;
      overflow: hidden;
    `;
    this._timerFill = document.createElement('div');
    this._timerFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: #ffcc00;
      border-radius: 3px;
      transition: width 0.1s;
    `;
    this._timerEl.appendChild(this._timerFill);
    this._container.appendChild(this._timerEl);

    // Lista de tricks del combo (debajo del timer)
    this._tricksEl = document.createElement('div');
    this._tricksEl.style.cssText = `
      position: absolute;
      top: 130px;
      left: 20px;
      font-size: 14px;
      max-width: 300px;
    `;
    this._container.appendChild(this._tricksEl);

    // Nivel y XP bar (esquina inferior izquierda)
    this._levelEl = document.createElement('div');
    this._levelEl.style.cssText = `
      position: absolute;
      bottom: 40px;
      left: 20px;
      font-size: 16px;
    `;
    this._levelEl.textContent = 'NIVEL 1';
    this._container.appendChild(this._levelEl);

    this._xpBarEl = document.createElement('div');
    this._xpBarEl.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: 200px;
      height: 8px;
      background: rgba(255,255,255,0.2);
      border-radius: 4px;
      overflow: hidden;
    `;
    this._xpBarFillEl = document.createElement('div');
    this._xpBarFillEl.style.cssText = `
      width: 0%;
      height: 100%;
      background: #00ff88;
      border-radius: 4px;
      transition: width 0.3s;
    `;
    this._xpBarEl.appendChild(this._xpBarFillEl);
    this._container.appendChild(this._xpBarEl);

    // Popup de trick (centro superior)
    this._trickPopupEl = document.createElement('div');
    this._trickPopupEl.style.cssText = `
      position: absolute;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 36px;
      font-weight: bold;
      color: #ffcc00;
      text-shadow: 0 0 20px rgba(255,200,0,0.8), 2px 2px 4px rgba(0,0,0,0.9);
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: 0;
      transition: opacity 0.2s;
      white-space: nowrap;
      pointer-events: none;
    `;
    this._container.appendChild(this._trickPopupEl);

    // Guía de controles (esquina inferior derecha)
    const controls = document.createElement('div');
    controls.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      text-align: right;
      line-height: 1.8;
    `;
    controls.innerHTML = `
      <div>WASD / Stick — mover</div>
      <div>SPACE / A — saltar</div>
      <div>1 / X — Kickflip</div>
      <div>2 / Y — Heelflip</div>
      <div>Q / LB — Indy Grab</div>
      <div>E / RB — Nose Grab</div>
      <div>1+2 — 360 Flip | Q+E — Stalefish</div>
      <div>M — Manual · R / B — Respawn</div>
      <div>T — Chat · Tab — Ranking · L — Logros</div>
      <div>P — Skin · G — Replay</div>
    `;
    this._container.appendChild(controls);

    // Combo end flash (centro inferior)
    this._comboEndEl = document.createElement('div');
    this._comboEndEl.style.cssText = `
      position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%);
      font-size: 52px; font-weight: bold; color: white;
      text-shadow: 0 0 30px rgba(255,255,100,0.9), 3px 3px 0 rgba(0,0,0,0.7);
      letter-spacing: 1px; text-align: center; opacity: 0; pointer-events: none;
      white-space: nowrap;
    `;
    this._container.appendChild(this._comboEndEl);

    // XP gained notification (esquina inferior izquierda, sobre la barra)
    this._xpGainEl = document.createElement('div');
    this._xpGainEl.style.cssText = `
      position: absolute; bottom: 56px; left: 20px;
      font-size: 14px; font-weight: bold; color: #00ff88;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
      opacity: 0; pointer-events: none;
    `;
    this._container.appendChild(this._xpGainEl);

    // Speed indicator (encima del nivel)
    this._speedEl = document.createElement('div');
    this._speedEl.style.cssText = `
      position: absolute; bottom: 68px; left: 20px;
      font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 1px;
    `;
    this._speedEl.textContent = '0 km/h';
    this._container.appendChild(this._speedEl);

    // Level-up notification (centro pantalla)
    this._levelUpEl = document.createElement('div');
    this._levelUpEl.style.cssText = `
      position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
      font-size: 28px; font-weight: bold; color: #00ff88;
      text-shadow: 0 0 30px rgba(0,255,136,0.9), 2px 2px 4px rgba(0,0,0,0.9);
      letter-spacing: 3px; text-transform: uppercase; text-align: center;
      opacity: 0; pointer-events: none; white-space: nowrap;
    `;
    this._container.appendChild(this._levelUpEl);

    document.body.appendChild(this._container);
  }

  showComboEnd(score, trickCount) {
    if (score <= 0) return;
    this._comboEndEl.innerHTML = `${score.toLocaleString()}<div style="font-size:18px; margin-top:4px; color:#ffcc00;">${trickCount} trick${trickCount !== 1 ? 's' : ''}</div>`;
    this._comboEndEl.style.opacity = '1';
    this._comboEndEl.style.transition = 'none';
    this._comboEndEl.style.transform = 'translateX(-50%) scale(1.3)';
    setTimeout(() => {
      this._comboEndEl.style.transform = 'translateX(-50%) scale(1)';
      this._comboEndEl.style.transition = 'transform 0.2s';
    }, 50);
    setTimeout(() => {
      this._comboEndEl.style.opacity = '0';
      this._comboEndEl.style.transition = 'opacity 0.8s';
    }, 2000);
  }

  showXpGain(xpGained) {
    if (!xpGained || xpGained <= 0) return;
    this._xpGainEl.textContent = `+${xpGained} XP`;
    this._xpGainEl.style.opacity = '1';
    this._xpGainEl.style.transition = 'none';
    this._xpGainEl.style.transform = 'translateY(0)';
    setTimeout(() => {
      this._xpGainEl.style.opacity = '0';
      this._xpGainEl.style.transform = 'translateY(-20px)';
      this._xpGainEl.style.transition = 'opacity 1s, transform 1s';
    }, 1200);
  }

  showLevelUp(newLevel, unlockedTricks = []) {
    const extra = unlockedTricks.length > 0
      ? `<div style="font-size:16px; margin-top:6px; color:#ffcc00;">¡Nuevos tricks: ${unlockedTricks.join(', ')}!</div>`
      : '';
    this._levelUpEl.innerHTML = `¡SUBISTE DE NIVEL!<br><span style="font-size:48px;">NIVEL ${newLevel}</span>${extra}`;
    this._levelUpEl.style.opacity = '1';
    this._levelUpEl.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      this._levelUpEl.style.opacity = '0';
      this._levelUpEl.style.transition = 'opacity 1s';
    }, 3000);
  }

  /**
   * Muestra un popup animado con el nombre del trick.
   * @param {string} trickName
   */
  showTrickPopup(trickName) {
    if (this._trickPopupTimeout) clearTimeout(this._trickPopupTimeout);
    this._trickPopupEl.textContent = trickName;
    this._trickPopupEl.style.opacity = '1';
    this._trickPopupEl.style.transform = 'translateX(-50%) scale(1.2)';
    this._trickPopupEl.style.transition = 'opacity 0.1s, transform 0.1s';

    setTimeout(() => {
      this._trickPopupEl.style.transform = 'translateX(-50%) scale(1)';
    }, 100);

    this._trickPopupTimeout = setTimeout(() => {
      this._trickPopupEl.style.opacity = '0';
      this._trickPopupEl.style.transition = 'opacity 0.5s';
    }, 1500);
  }

  /**
   * Actualiza el HUD con datos del combo y progresión.
   * @param {Object} data
   * @param {number} data.score - Puntos totales
   * @param {number} data.multiplier - Multiplicador actual
   * @param {number} data.timer - Timer restante del combo
   * @param {number} data.maxTimer - Timer máximo del combo
   * @param {Array} data.tricks - Lista de tricks del combo
   * @param {number} data.level - Nivel actual
   * @param {number} data.xp - XP actual
   * @param {number} data.xpToNext - XP necesario para el próximo nivel
   */
  update(data) {
    // Score con flash al subir
    if (data.score !== this._prevScore) {
      this._scoreEl.style.color = '#ffff00';
      this._scoreEl.style.transition = 'color 0.3s';
      setTimeout(() => { this._scoreEl.style.color = 'white'; }, 300);
      this._prevScore = data.score;
    }
    this._scoreEl.textContent = data.score.toLocaleString();

    // Velocidad
    if (data.speed !== undefined) {
      const kmh = Math.round(data.speed * 3.6);
      this._speedEl.textContent = `${kmh} km/h`;
      this._speedEl.style.color = kmh > 30 ? '#ff8800' : 'rgba(255,255,255,0.5)';
    }

    // Multiplicador
    this._multiplierEl.textContent = `x${data.multiplier}`;
    this._multiplierEl.style.color = data.multiplier >= 4 ? '#ff4400' : data.multiplier >= 3 ? '#ff8800' : '#ffcc00';

    // Timer bar
    const timerPct = data.maxTimer > 0 ? (data.timer / data.maxTimer) * 100 : 0;
    this._timerFill.style.width = `${Math.max(0, timerPct)}%`;
    this._timerFill.style.background = timerPct < 25 ? '#ff4444' : timerPct < 50 ? '#ffaa00' : '#ffcc00';

    // Tricks del combo
    if (data.tricks && data.tricks.length > 0) {
      this._tricksEl.textContent = data.tricks.map(t => t.name).join(' → ');
    } else {
      this._tricksEl.textContent = '';
    }

    // Nivel y XP
    this._levelEl.textContent = `NIVEL ${data.level}  ${data.xp} / ${data.xpToNext} XP`;

    // XP bar
    const xpPct = data.xpToNext > 0 ? (data.xp / data.xpToNext) * 100 : 0;
    this._xpBarFillEl.style.width = `${Math.min(100, xpPct)}%`;
  }

  destroy() {
    if (this._container) {
      document.body.removeChild(this._container);
    }
  }
}
