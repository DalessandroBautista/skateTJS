/**
 * ChatUI.js - Chat en tiempo real dentro de la sala
 */
import { networkManager } from '../network/NetworkManager.js';

export class ChatUI {
  constructor() {
    this._el = null;
    this._messages = [];
    this._open = false;
    this._hideTimer = null;
    this._build();
    this._setupHandlers();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'chat-ui';
    this._el.style.cssText = `
      position: fixed; bottom: 60px; right: 20px; width: 280px;
      font-family: Arial, sans-serif; pointer-events: none; z-index: 20;
    `;

    this._messagesEl = document.createElement('div');
    this._messagesEl.style.cssText = `
      max-height: 150px; overflow: hidden; display: flex;
      flex-direction: column; justify-content: flex-end; gap: 4px; margin-bottom: 8px;
    `;
    this._el.appendChild(this._messagesEl);

    this._inputRow = document.createElement('div');
    this._inputRow.style.cssText = `display: none; pointer-events: auto;`;
    this._inputEl = document.createElement('input');
    this._inputEl.placeholder = 'Mensaje... (Enter para enviar, Esc para cerrar)';
    this._inputEl.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 8px 12px;
      background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px; color: white; font-size: 13px; outline: none;
    `;
    this._inputRow.appendChild(this._inputEl);
    this._el.appendChild(this._inputRow);

    document.body.appendChild(this._el);

    // T para abrir chat
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' && !this._open && e.target === document.body) {
        e.preventDefault();
        this._openChat();
      } else if (e.code === 'Escape' && this._open) {
        this._closeChat();
      } else if (e.code === 'Enter' && this._open) {
        this._send();
      }
    });
  }

  _setupHandlers() {
    networkManager.on('chat_message', ({ username, text }) => {
      this._addMessage(username, text);
    });
  }

  _addMessage(username, text) {
    const msg = document.createElement('div');
    msg.style.cssText = `
      background: rgba(0,0,0,0.65); padding: 4px 8px; border-radius: 4px;
      font-size: 13px; color: white; word-break: break-word;
    `;
    msg.innerHTML = `<span style="color:#ffcc00; font-weight:bold;">${this._esc(username)}</span>: ${this._esc(text)}`;
    this._messagesEl.appendChild(msg);

    // Mantener últimos 8 mensajes
    while (this._messagesEl.children.length > 8) {
      this._messagesEl.removeChild(this._messagesEl.firstChild);
    }

    // Auto-ocultar mensajes después de 6s
    clearTimeout(this._hideTimer);
    this._messagesEl.style.opacity = '1';
    this._hideTimer = setTimeout(() => {
      if (!this._open) this._messagesEl.style.opacity = '0.3';
    }, 6000);
  }

  _openChat() {
    this._open = true;
    this._inputRow.style.display = '';
    this._messagesEl.style.opacity = '1';
    setTimeout(() => this._inputEl.focus(), 10);
  }

  _closeChat() {
    this._open = false;
    this._inputEl.value = '';
    this._inputRow.style.display = 'none';
  }

  _send() {
    const text = this._inputEl.value.trim();
    if (text) {
      networkManager.sendChat(text);
      this._addMessage(networkManager.user?.username || 'Tú', text);
    }
    this._closeChat();
  }

  _esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}
