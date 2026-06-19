/**
 * NetworkManager.js
 *
 * Gestiona la conexión Socket.io y las llamadas REST al servidor.
 * Singleton — se importa donde se necesite.
 */
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

class NetworkManager {
  constructor() {
    this.socket = null;
    this.token = localStorage.getItem('skate_token') || null;
    this.user = JSON.parse(localStorage.getItem('skate_user') || 'null');
    this._handlers = new Map();
  }

  // --- REST API ---

  async register(username, email, password) {
    const res = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de registro');
    this._saveAuth(data);
    return data;
  }

  async login(email, password) {
    const res = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de login');
    this._saveAuth(data);
    return data;
  }

  async submitScore(score, mapId = 'plaza', tricks = 0) {
    if (!this.token) return null;
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ score, mapId, tricks }),
      });
      const data = await res.json();
      if (data.ok && this.user) {
        const prevLevel = this.user.level;
        this.user.xp = (this.user.xp || 0) + (data.xpGained || 0);
        this.user.level = data.newLevel || this.user.level;
        localStorage.setItem('skate_user', JSON.stringify(this.user));
        return { xpGained: data.xpGained, newLevel: data.newLevel, leveledUp: data.newLevel > prevLevel };
      }
      return null;
    } catch { return null; }
  }

  async unlockAchievement(achievementId) {
    if (!this.token) return;
    try {
      await fetch(`${SERVER_URL}/api/auth/achievement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ achievementId }),
      });
    } catch {}
  }

  async fetchAchievements() {
    if (!this.token) return [];
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/achievements`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.achievements || [];
    } catch { return []; }
  }

  logout() {
    localStorage.removeItem('skate_token');
    localStorage.removeItem('skate_user');
    this.token = null;
    this.user = null;
    this.disconnect();
  }

  _saveAuth({ user, token }) {
    this.token = token;
    this.user = user;
    localStorage.setItem('skate_token', token);
    localStorage.setItem('skate_user', JSON.stringify(user));
  }

  // --- Socket.io ---

  connect() {
    if (this.socket?.connected) return;
    this.socket = io(SERVER_URL, {
      auth: { token: this.token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('[Network] Conectado:', this.socket.id);
      this._emit('connected');
    });
    this.socket.on('disconnect', () => {
      console.log('[Network] Desconectado');
      this._emit('disconnected');
    });
    this.socket.on('room_state', (data) => this._emit('room_state', data));
    this.socket.on('room_created', (data) => this._emit('room_created', data));
    this.socket.on('join_error', (data) => this._emit('join_error', data));
    this.socket.on('player_joined', (data) => this._emit('player_joined', data));
    this.socket.on('player_left', (data) => this._emit('player_left', data));
    this.socket.on('player_update', (data) => this._emit('player_update', data));
    this.socket.on('player_trick', (data) => this._emit('player_trick', data));
    this.socket.on('player_skin', (data) => this._emit('player_skin', data));
    this.socket.on('chat_message', (data) => this._emit('chat_message', data));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinPublic(mapId = 'plaza') {
    this.socket?.emit('join_public', { mapId });
  }

  createPrivate(mapId = 'plaza') {
    this.socket?.emit('create_private', { mapId });
  }

  joinPrivate(code) {
    this.socket?.emit('join_private', { code });
  }

  sendPlayerUpdate(data) {
    this.socket?.volatile.emit('player_update', data);
  }

  sendTrick(name, points) {
    this.socket?.emit('player_trick', { name, points });
  }

  sendChat(text) {
    this.socket?.emit('chat_message', { text });
  }

  sendSkin(skinId) {
    this.socket?.emit('player_skin', { skinId });
  }

  // --- Event emitter simple ---
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
  }

  off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  }

  _emit(event, data) {
    this._handlers.get(event)?.forEach(h => h(data));
  }
}

export const networkManager = new NetworkManager();
