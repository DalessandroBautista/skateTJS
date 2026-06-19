/**
 * RoomLeaderboard.js
 *
 * Leaderboard en tiempo real de la sala actual.
 * Muestra scores de todos los jugadores en la esquina superior derecha.
 * Se actualiza cuando alguien hace un trick o termina un combo.
 */
import { networkManager } from '../network/NetworkManager.js';

export class RoomLeaderboard {
  constructor() {
    this._scores = new Map(); // socketId → { username, score }
    this._el = null;
    this._listEl = null;

    // Inicializar con el jugador local
    const me = networkManager.user;
    if (me) {
      this._scores.set('local', { username: me.username, score: 0 });
    }

    this._build();
    this._setupHandlers();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'room-leaderboard';
    this._el.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      min-width: 160px; max-width: 220px;
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; padding: 10px 14px;
      font-family: 'Arial Black', Arial, sans-serif;
      color: white; z-index: 15; pointer-events: none;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 11px; color: #ffcc00; letter-spacing: 2px;
      text-transform: uppercase; margin-bottom: 8px; opacity: 0.8;
    `;
    title.textContent = 'SALA';
    this._el.appendChild(title);

    this._listEl = document.createElement('div');
    this._el.appendChild(this._listEl);

    document.body.appendChild(this._el);
    this._render();
  }

  _setupHandlers() {
    networkManager.on('room_state', ({ players }) => {
      for (const p of players) {
        if (!this._scores.has(p.id)) {
          this._scores.set(p.id, { username: p.username, score: 0 });
        }
      }
      this._render();
    });

    networkManager.on('player_joined', ({ id, username }) => {
      this._scores.set(id, { username, score: 0 });
      this._render();
    });

    networkManager.on('player_left', ({ id }) => {
      this._scores.delete(id);
      this._render();
    });

    networkManager.on('player_trick', ({ id, name, points }) => {
      const entry = this._scores.get(id);
      if (entry) {
        entry.score += points || 0;
        this._render();
      }
    });
  }

  updateLocalScore(score) {
    const entry = this._scores.get('local');
    if (entry) {
      entry.score = score;
      this._render();
    }
  }

  _render() {
    const sorted = [...this._scores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 8);

    this._listEl.innerHTML = sorted.map(([id, { username, score }], idx) => {
      const isLocal = id === 'local';
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center;
          padding: 2px 0; font-size:13px;
          color: ${isLocal ? '#00ff88' : 'rgba(255,255,255,0.85)'}; font-weight: ${isLocal ? 'bold' : 'normal'};">
          <span style="margin-right:6px; font-size:11px;">${medal}</span>
          <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${username}</span>
          <span style="margin-left:8px; color:#ffcc00; font-size:12px;">${score.toLocaleString()}</span>
        </div>
      `;
    }).join('');
  }

  destroy() {
    this._el?.remove();
  }
}
