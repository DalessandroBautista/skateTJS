/**
 * SkinSelector.js
 *
 * Overlay para elegir skin del skater. Tecla P para abrir/cerrar.
 * Persiste en localStorage. Llama a onSelect(skinId) al elegir.
 */
import { SkaterModel } from '../world/SkaterModel.js';

const STORAGE_KEY = 'skate_skin';

export class SkinSelector {
  constructor() {
    this._container = null;
    this._visible = false;
    this._currentSkin = localStorage.getItem(STORAGE_KEY) || 'red';
    this._onSelect = null;
    this._build();
    this._bindKey();
  }

  get currentSkin() { return this._currentSkin; }

  /** @param {(skinId: string) => void} fn */
  onSelect(fn) { this._onSelect = fn; }

  _build() {
    this._container = document.createElement('div');
    this._container.style.cssText = `
      display: none;
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.75);
      z-index: 200;
      align-items: center;
      justify-content: center;
      font-family: 'Arial Black', Arial, sans-serif;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #1a1a2e;
      border: 2px solid #444;
      border-radius: 12px;
      padding: 28px 36px;
      text-align: center;
      color: white;
      max-width: 480px;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 22px; font-weight: bold; margin-bottom: 6px; letter-spacing: 2px;';
    title.textContent = 'ELIGE TU SKIN';
    panel.appendChild(title);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 20px;';
    hint.textContent = 'P para cerrar';
    panel.appendChild(hint);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;';

    for (const skin of SkaterModel.SKINS) {
      const btn = document.createElement('div');
      btn.dataset.skinId = skin.id;
      const hex = '#' + skin.shirt.toString(16).padStart(6, '0');
      const boardHex = '#' + skin.board.toString(16).padStart(6, '0');
      const isSelected = skin.id === this._currentSkin;

      btn.style.cssText = `
        cursor: pointer;
        border-radius: 10px;
        padding: 12px 8px;
        border: 3px solid ${isSelected ? '#ffcc00' : 'transparent'};
        background: rgba(255,255,255,0.05);
        transition: border-color 0.15s, transform 0.1s;
        display: flex; flex-direction: column; align-items: center; gap: 6px;
      `;

      // Swatches de color
      const swatches = document.createElement('div');
      swatches.style.cssText = 'display: flex; gap: 4px;';

      const s1 = document.createElement('div');
      s1.style.cssText = `width: 22px; height: 22px; border-radius: 4px; background: ${hex};`;
      const s2 = document.createElement('div');
      s2.style.cssText = `width: 22px; height: 22px; border-radius: 4px; background: ${boardHex};`;
      swatches.appendChild(s1);
      swatches.appendChild(s2);
      btn.appendChild(swatches);

      const label = document.createElement('div');
      label.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.7);';
      label.textContent = skin.label;
      btn.appendChild(label);

      btn.addEventListener('mouseenter', () => {
        if (skin.id !== this._currentSkin) btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
      btn.addEventListener('click', () => this._select(skin.id));

      grid.appendChild(btn);
      btn.dataset.element = 'true'; // para re-render
    }

    panel.appendChild(grid);
    this._panel = panel;
    this._grid = grid;
    this._container.appendChild(panel);
    document.body.appendChild(this._container);
  }

  _select(skinId) {
    this._currentSkin = skinId;
    localStorage.setItem(STORAGE_KEY, skinId);
    // Actualizar bordes en el grid
    for (const btn of this._grid.children) {
      btn.style.borderColor = btn.dataset.skinId === skinId ? '#ffcc00' : 'transparent';
    }
    if (this._onSelect) this._onSelect(skinId);
  }

  _bindKey() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && !e.repeat) this.toggle();
    });
  }

  toggle() {
    this._visible = !this._visible;
    this._container.style.display = this._visible ? 'flex' : 'none';
  }

  destroy() {
    document.body.removeChild(this._container);
  }
}
