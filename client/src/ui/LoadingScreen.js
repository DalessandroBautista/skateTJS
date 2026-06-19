/**
 * LoadingScreen.js
 *
 * Overlay de carga que se muestra mientras el mapa se inicializa.
 * Se cierra llamando a .hide() cuando el juego está listo.
 */
export class LoadingScreen {
  constructor(mapId = 'plaza') {
    this._el = null;
    this._build(mapId);
  }

  _build(mapId) {
    const mapNames = { plaza: 'PLAZA', park: 'PARK', streets: 'STREETS' };
    const mapColors = { plaza: '#4488ff', park: '#00cc44', streets: '#888' };

    this._el = document.createElement('div');
    this._el.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 100; font-family: 'Arial Black', Arial, sans-serif; color: white;
    `;

    this._el.innerHTML = `
      <div style="font-size:13px; letter-spacing:4px; color:rgba(255,255,255,0.4); margin-bottom:12px; text-transform:uppercase;">
        Cargando mapa
      </div>
      <div style="font-size:42px; font-weight:bold; letter-spacing:6px; color:${mapColors[mapId] || '#fff'}; margin-bottom:40px;">
        ${mapNames[mapId] || mapId.toUpperCase()}
      </div>
      <div id="loading-bar-wrap" style="width:240px; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; overflow:hidden;">
        <div id="loading-bar" style="width:0%; height:100%; background:${mapColors[mapId] || '#fff'}; border-radius:2px; transition:width 0.2s;"></div>
      </div>
      <div id="loading-tip" style="margin-top:32px; font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:1px; max-width:300px; text-align:center;">
        WASD para moverse · SPACE para saltar · 1/2 para tricks
      </div>
    `;

    document.body.appendChild(this._el);

    // Simular progreso de carga
    let pct = 0;
    this._interval = setInterval(() => {
      pct = Math.min(90, pct + Math.random() * 15);
      const bar = document.getElementById('loading-bar');
      if (bar) bar.style.width = `${pct}%`;
    }, 80);
  }

  hide() {
    // Completar la barra y hacer fade out
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = '100%';
    clearInterval(this._interval);

    setTimeout(() => {
      this._el.style.transition = 'opacity 0.4s';
      this._el.style.opacity = '0';
      setTimeout(() => this._el.remove(), 400);
    }, 200);
  }
}
