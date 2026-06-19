/**
 * GlobalLeaderboard.js
 *
 * Overlay de top 20 scores globales del mapa actual.
 * Se abre/cierra con Tab.
 * Carga datos de GET /api/scores/:mapId
 */
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export class GlobalLeaderboard {
  constructor(mapId = 'plaza') {
    this._mapId = mapId;
    this._el = null;
    this._open = false;
    this._build();
    this._setupKey();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'global-lb';
    this._el.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 380px; max-height: 80vh; overflow-y: auto;
      background: rgba(0,0,0,0.92); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px; padding: 24px; z-index: 30;
      font-family: 'Arial Black', Arial, sans-serif; color: white;
      display: none;
    `;
    document.body.appendChild(this._el);
  }

  _setupKey() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this._open ? this.hide() : this.show();
      }
    });
  }

  async show() {
    this._open = true;
    this._el.style.display = 'block';
    this._el.innerHTML = `
      <div style="text-align:center; color:#ffcc00; font-size:14px; letter-spacing:3px; margin-bottom:16px;">
        TOP 20 — ${this._mapId.toUpperCase()}
      </div>
      <div style="color:rgba(255,255,255,0.4); text-align:center; font-size:12px;">Cargando...</div>
    `;

    try {
      const res = await fetch(`${SERVER_URL}/api/scores/${this._mapId}`);
      const data = await res.json();
      this._render(data.scores || []);
    } catch {
      this._el.innerHTML += `<div style="color:#ff4444; text-align:center; font-size:12px;">Sin conexión</div>`;
    }
  }

  _render(scores) {
    const rows = scores.length === 0
      ? `<div style="text-align:center; color:rgba(255,255,255,0.3); font-size:13px; margin-top:12px;">Sin scores todavía — ¡sé el primero!</div>`
      : scores.map(s => {
          const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `${s.rank}.`;
          return `
            <div style="display:flex; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px;">
              <span style="width:32px; text-align:center; font-size:12px;">${medal}</span>
              <span style="flex:1;">${s.username}</span>
              <span style="color:rgba(255,255,255,0.4); font-size:11px; margin-right:12px;">Nv.${s.level}</span>
              <span style="color:#ffcc00; font-weight:bold;">${s.score.toLocaleString()}</span>
            </div>
          `;
        }).join('');

    this._el.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <div style="color:#ffcc00; font-size:14px; letter-spacing:3px;">TOP 20 — ${this._mapId.toUpperCase()}</div>
        <div style="color:rgba(255,255,255,0.3); font-size:11px;">Tab para cerrar</div>
      </div>
      ${rows}
    `;
  }

  hide() {
    this._open = false;
    this._el.style.display = 'none';
  }

  destroy() {
    this._el?.remove();
  }
}
