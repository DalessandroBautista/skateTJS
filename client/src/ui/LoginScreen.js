/**
 * LoginScreen.js
 *
 * Pantalla de login/registro superpuesta sobre el canvas.
 * Se muestra antes del juego. Al autenticarse, se oculta y arranca el juego.
 */
import { networkManager } from '../network/NetworkManager.js';

export class LoginScreen {
  constructor({ onReady }) {
    this._onReady = onReady;
    this._el = null;
    this._build();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'login-screen';
    this._el.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
      display: flex; align-items: center; justify-content: center;
      z-index: 100; font-family: 'Arial Black', Arial, sans-serif; color: white;
    `;

    this._el.innerHTML = `
      <div style="text-align:center; max-width:380px; width:90%;">
        <div style="font-size:52px; margin-bottom:4px;">🛹</div>
        <h1 style="font-size:28px; margin:0 0 4px; letter-spacing:3px; color:#ffcc00;">SKATE GAME</h1>
        <p style="color:rgba(255,255,255,0.5); margin:0 0 32px; font-size:13px;">Tony Hawk vibes, online</p>

        <!-- Tabs -->
        <div style="display:flex; margin-bottom:24px; border-bottom:2px solid rgba(255,255,255,0.1);">
          <button id="tab-login" style="flex:1; padding:10px; background:none; border:none; border-bottom:2px solid #ffcc00; color:#ffcc00; font-size:14px; font-weight:bold; cursor:pointer; margin-bottom:-2px;">INGRESAR</button>
          <button id="tab-register" style="flex:1; padding:10px; background:none; border:none; border-bottom:2px solid transparent; color:rgba(255,255,255,0.5); font-size:14px; cursor:pointer; margin-bottom:-2px;">REGISTRARSE</button>
        </div>

        <!-- Login form -->
        <div id="form-login">
          <input id="login-email" type="email" placeholder="Email" style="${this._inputStyle()}">
          <input id="login-password" type="password" placeholder="Contraseña" style="${this._inputStyle()}">
          <button id="btn-login" style="${this._btnStyle('#ffcc00', '#000')}">ENTRAR</button>
        </div>

        <!-- Register form -->
        <div id="form-register" style="display:none;">
          <input id="reg-username" type="text" placeholder="Username (3-20 chars)" style="${this._inputStyle()}">
          <input id="reg-email" type="email" placeholder="Email" style="${this._inputStyle()}">
          <input id="reg-password" type="password" placeholder="Contraseña (mín 6)" style="${this._inputStyle()}">
          <button id="btn-register" style="${this._btnStyle('#00ff88', '#000')}">CREAR CUENTA</button>
        </div>

        <!-- Guest option -->
        <div style="margin-top:20px;">
          <button id="btn-guest" style="background:none; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.5); padding:8px 24px; border-radius:4px; cursor:pointer; font-size:12px;">
            Jugar como invitado (sin guardar progreso)
          </button>
        </div>

        <div id="auth-error" style="margin-top:16px; color:#ff4444; font-size:13px; min-height:20px;"></div>
      </div>
    `;

    document.body.appendChild(this._el);
    this._attachEvents();

    // Si ya hay sesión guardada, auto-login
    if (networkManager.user && networkManager.token) {
      this._startGame();
    }
  }

  _inputStyle() {
    return `display:block; width:100%; box-sizing:border-box; padding:12px 16px; margin-bottom:12px;
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
      border-radius:6px; color:white; font-size:15px; outline:none;`;
  }

  _btnStyle(bg, color) {
    return `display:block; width:100%; padding:14px; margin-top:8px;
      background:${bg}; color:${color}; border:none; border-radius:6px;
      font-size:16px; font-weight:bold; cursor:pointer; letter-spacing:1px;
      transition:opacity 0.2s;`;
  }

  _attachEvents() {
    const $ = id => document.getElementById(id);

    // Tabs
    $('tab-login').addEventListener('click', () => this._showTab('login'));
    $('tab-register').addEventListener('click', () => this._showTab('register'));

    // Login
    $('btn-login').addEventListener('click', () => this._doLogin());
    $('login-password').addEventListener('keydown', e => e.key === 'Enter' && this._doLogin());

    // Register
    $('btn-register').addEventListener('click', () => this._doRegister());
    $('reg-password').addEventListener('keydown', e => e.key === 'Enter' && this._doRegister());

    // Guest
    $('btn-guest').addEventListener('click', () => this._startGame());
  }

  _showTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('form-login').style.display = isLogin ? '' : 'none';
    document.getElementById('form-register').style.display = isLogin ? 'none' : '';
    document.getElementById('tab-login').style.cssText += isLogin
      ? 'border-bottom-color:#ffcc00; color:#ffcc00;' : 'border-bottom-color:transparent; color:rgba(255,255,255,0.5);';
    document.getElementById('tab-register').style.cssText += !isLogin
      ? 'border-bottom-color:#00ff88; color:#00ff88;' : 'border-bottom-color:transparent; color:rgba(255,255,255,0.5);';
    this._setError('');
  }

  _setError(msg) {
    document.getElementById('auth-error').textContent = msg;
  }

  async _doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return this._setError('Completá todos los campos');
    try {
      document.getElementById('btn-login').textContent = 'Entrando...';
      await networkManager.login(email, password);
      this._startGame();
    } catch (err) {
      this._setError(err.message);
      document.getElementById('btn-login').textContent = 'ENTRAR';
    }
  }

  async _doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!username || !email || !password) return this._setError('Completá todos los campos');
    try {
      document.getElementById('btn-register').textContent = 'Creando cuenta...';
      await networkManager.register(username, email, password);
      this._startGame();
    } catch (err) {
      this._setError(err.message);
      document.getElementById('btn-register').textContent = 'CREAR CUENTA';
    }
  }

  _startGame() {
    this._el.style.transition = 'opacity 0.5s';
    this._el.style.opacity = '0';
    setTimeout(() => {
      this._el.remove();
      this._onReady(networkManager.user);
    }, 500);
  }
}
