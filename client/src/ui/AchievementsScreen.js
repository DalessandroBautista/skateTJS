/**
 * AchievementsScreen.js
 *
 * Pantalla de logros — toggle con tecla L.
 * Muestra todos los logros con ícono, nombre, descripción, estado y progreso.
 */
import { achievementSystem } from '../systems/AchievementSystem.js';

export class AchievementsScreen {
  constructor() {
    this._visible = false;
    this._el = this._build();
    window.addEventListener('keydown', (e) => {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (e.code === 'KeyL' && !typing) { e.preventDefault(); this.toggle(); }
    });
  }

  _build() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.85);
      display: none; align-items: center; justify-content: center;
      z-index: 8000; font-family: Arial, sans-serif;
    `;
    document.body.appendChild(el);
    return el;
  }

  _render() {
    const all = achievementSystem.getAll();
    const unlocked = all.filter(a => a.unlocked).length;

    this._el.innerHTML = `
      <div style="
        background: #111; border: 2px solid #ffcc00;
        border-radius: 16px; padding: 28px 32px; max-width: 600px; width: 90%;
        max-height: 80vh; overflow-y: auto; color: #fff;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="color:#ffcc00; margin:0; font-size:22px;">🏆 LOGROS</h2>
          <span style="color:#aaa; font-size:14px;">${unlocked}/${all.length} desbloqueados · <kbd style="background:#333;padding:2px 6px;border-radius:4px;font-size:12px;">L</kbd> para cerrar</span>
        </div>
        <div style="display:grid; gap:10px;">
          ${all.map(a => `
            <div style="
              display:flex; align-items:center; gap:14px;
              background: ${a.unlocked ? 'rgba(255,204,0,0.1)' : '#1a1a1a'};
              border: 1px solid ${a.unlocked ? '#ffcc00' : '#333'};
              border-radius:10px; padding:12px 16px;
              opacity: ${a.unlocked ? '1' : '0.6'};
            ">
              <div style="font-size:28px; min-width:36px; text-align:center; ${!a.unlocked ? 'filter:grayscale(1)' : ''}">${a.icon}</div>
              <div style="flex:1;">
                <div style="font-weight:bold; color:${a.unlocked ? '#ffcc00' : '#888'}; font-size:14px;">${a.name}</div>
                <div style="color:#aaa; font-size:12px; margin-top:2px;">${a.desc}</div>
                <div style="color:#666; font-size:11px; margin-top:3px;">${a.progress}</div>
              </div>
              <div style="font-size:20px;">${a.unlocked ? '✅' : '🔒'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  toggle() {
    this._visible = !this._visible;
    if (this._visible) {
      this._render();
      this._el.style.display = 'flex';
    } else {
      this._el.style.display = 'none';
    }
  }
}
