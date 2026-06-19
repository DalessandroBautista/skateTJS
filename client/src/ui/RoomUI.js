/**
 * RoomUI.js
 *
 * Overlay de salas: unirse a pública, crear privada, unirse a privada con código.
 * Se muestra después del login y antes de entrar al juego.
 */
import { networkManager } from '../network/NetworkManager.js';

export class RoomUI {
  constructor({ onEnterRoom }) {
    this._onEnterRoom = onEnterRoom;
    this._el = null;
    this._build();
    this._setupHandlers();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'room-ui';
    this._el.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); display: flex; align-items: center;
      justify-content: center; z-index: 50;
      font-family: 'Arial Black', Arial, sans-serif; color: white;
    `;

    this._el.innerHTML = `
      <div style="text-align:center; max-width:420px; width:90%;">
        <h2 style="font-size:20px; margin:0 0 8px; color:#ffcc00; letter-spacing:2px;">SELECCIONÁ TU SALA</h2>
        <p style="color:rgba(255,255,255,0.4); font-size:12px; margin:0 0 28px;">Hola, <span id="room-username" style="color:#00ff88;"></span></p>

        <!-- Unirse a pública -->
        <div style="background:rgba(255,255,255,0.06); border-radius:10px; padding:20px; margin-bottom:16px;">
          <div style="font-size:14px; margin-bottom:12px; color:#ffcc00;">SALA PÚBLICA</div>
          <div style="display:flex; gap:8px;">
            <select id="room-map" style="flex:1; padding:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:white; font-size:14px;">
              <option value="plaza">Plaza</option>
              <option value="park">Park</option>
              <option value="streets">Streets</option>
            </select>
            <button id="btn-join-public" style="${this._btnStyle('#ffcc00', '#000')}">ENTRAR</button>
          </div>
        </div>

        <!-- Crear sala privada -->
        <div style="background:rgba(255,255,255,0.06); border-radius:10px; padding:20px; margin-bottom:16px;">
          <div style="font-size:14px; margin-bottom:12px; color:#00ff88;">SALA PRIVADA</div>
          <div style="display:flex; gap:8px; margin-bottom:10px;">
            <button id="btn-create-private" style="${this._btnStyle('#00ff88', '#000')}">CREAR SALA</button>
          </div>
          <div style="display:flex; gap:8px;">
            <input id="room-code-input" type="text" placeholder="Código (6 letras)" maxlength="6"
              style="flex:1; padding:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:white; font-size:14px; text-transform:uppercase; letter-spacing:3px; outline:none;">
            <button id="btn-join-private" style="${this._btnStyle('#888', 'white')}">UNIRSE</button>
          </div>
        </div>

        <div id="room-error" style="color:#ff4444; font-size:13px; min-height:20px;"></div>
        <div id="room-code-display" style="display:none; margin-top:12px; background:rgba(0,255,136,0.1); border:1px solid #00ff88; border-radius:8px; padding:12px;">
          <div style="font-size:12px; color:#00ff88; margin-bottom:4px;">CÓDIGO DE TU SALA:</div>
          <div id="room-code-value" style="font-size:32px; letter-spacing:8px; font-weight:bold; color:white;"></div>
          <div style="font-size:11px; color:rgba(255,255,255,0.4); margin-top:4px;">Compartí este código con tus amigos</div>
        </div>
      </div>
    `;

    document.body.appendChild(this._el);

    // Mostrar username
    const usernameEl = document.getElementById('room-username');
    if (usernameEl) usernameEl.textContent = networkManager.user?.username || 'Invitado';
  }

  _btnStyle(bg, color) {
    return `padding:10px 20px; background:${bg}; color:${color}; border:none;
      border-radius:6px; font-size:14px; font-weight:bold; cursor:pointer; white-space:nowrap;`;
  }

  _setupHandlers() {
    // Cuando llega room_state, si estamos esperando mostrar el código, cachearlo.
    // Si no, entrar directo (unirse a sala pública o privada ya existente).
    this._pendingRoomData = null;
    this._waitingForCode = false;

    document.getElementById('btn-join-public')?.addEventListener('click', () => {
      const mapId = document.getElementById('room-map').value;
      networkManager.joinPublic(mapId);
    });

    document.getElementById('btn-create-private')?.addEventListener('click', () => {
      const mapId = document.getElementById('room-map').value;
      this._waitingForCode = true;
      networkManager.createPrivate(mapId);
    });

    document.getElementById('btn-join-private')?.addEventListener('click', () => {
      const code = document.getElementById('room-code-input').value.trim().toUpperCase();
      if (code.length !== 6) return this._setError('El código debe tener 6 caracteres');
      networkManager.joinPrivate(code);
    });

    networkManager.on('room_state', (data) => {
      if (this._waitingForCode) {
        // Guardar roomData y esperar a que el usuario vea el código
        this._pendingRoomData = data;
      } else {
        this._enterGame(data);
      }
    });

    networkManager.on('room_created', ({ code }) => {
      document.getElementById('room-code-value').textContent = code;
      document.getElementById('room-code-display').style.display = '';
      // Agregar botón para entrar al juego
      const existing = document.getElementById('btn-enter-game');
      if (!existing) {
        const btn = document.createElement('button');
        btn.id = 'btn-enter-game';
        btn.textContent = 'ENTRAR AL JUEGO';
        btn.style.cssText = `margin-top:14px; ${this._btnStyle('#ffcc00', '#000')} width:100%;`;
        btn.addEventListener('click', () => {
          if (this._pendingRoomData) this._enterGame(this._pendingRoomData);
        });
        document.getElementById('room-code-display').appendChild(btn);
      }
    });

    networkManager.on('join_error', ({ error }) => {
      this._waitingForCode = false;
      this._setError(error);
    });
  }

  _setError(msg) {
    const el = document.getElementById('room-error');
    if (el) el.textContent = msg;
  }

  _enterGame(roomData) {
    this._el.style.transition = 'opacity 0.4s';
    this._el.style.opacity = '0';
    setTimeout(() => {
      this._el.remove();
      this._onEnterRoom(roomData);
    }, 400);
  }
}
