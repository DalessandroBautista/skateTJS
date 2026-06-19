/**
 * AchievementNotification.js
 *
 * Muestra una notificación tipo "toast" cuando se desbloquea un logro.
 * Entra por la derecha con animación y se desvanece.
 */
export class AchievementNotification {
  constructor() {
    this._queue = [];
    this._showing = false;
    this._container = this._createContainer();
  }

  _createContainer() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; bottom: 80px; right: -400px;
      z-index: 9999; transition: right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
    `;
    document.body.appendChild(el);
    return el;
  }

  show(achievement) {
    this._queue.push(achievement);
    if (!this._showing) this._showNext();
  }

  _showNext() {
    if (this._queue.length === 0) { this._showing = false; return; }
    this._showing = true;
    const ach = this._queue.shift();

    this._container.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #ffcc00;
        border-radius: 12px;
        padding: 12px 20px;
        display: flex; align-items: center; gap: 14px;
        box-shadow: 0 4px 20px rgba(255,204,0,0.3);
        width: 320px;
      ">
        <div style="font-size: 36px; line-height: 1;">${ach.icon}</div>
        <div>
          <div style="color: #ffcc00; font-weight: bold; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px;">
            ¡Logro desbloqueado!
          </div>
          <div style="color: #fff; font-weight: bold; font-size: 16px;">${ach.name}</div>
          <div style="color: #aaa; font-size: 12px; margin-top: 2px;">${ach.desc}</div>
        </div>
      </div>
    `;

    // Slide in
    requestAnimationFrame(() => {
      this._container.style.right = '20px';
    });

    // Hold then slide out
    setTimeout(() => {
      this._container.style.right = '-400px';
      setTimeout(() => this._showNext(), 450);
    }, 3500);
  }
}
