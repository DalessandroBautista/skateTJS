/**
 * NetworkSystem.js
 *
 * Sincroniza el estado local del jugador con el servidor
 * y renderiza los otros jugadores remotos.
 *
 * Sprint 4.5: Delta compression + trick popups sobre jugadores remotos.
 */
import * as THREE from 'three';
import { networkManager } from '../network/NetworkManager.js';
import { SkaterModel } from '../world/SkaterModel.js';

const SYNC_INTERVAL = 1 / 20;     // 20 Hz
const DELTA_THRESHOLD = 0.05;     // metros
const INTERP_DELAY_MS = 100;      // renderizar 100ms detrás para tener buffer de historia
const MAX_HISTORY = 8;            // entradas máximas de historia por jugador

/** Interpolación Catmull-Rom entre p1 y p2, usando p0 y p3 como tangentes */
function catmullRomVec3(p0, p1, p2, p3, t, out) {
  const t2 = t * t, t3 = t2 * t;
  out.x = 0.5 * (2*p1.x + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3);
  out.y = 0.5 * (2*p1.y + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
  out.z = 0.5 * (2*p1.z + (-p0.z+p2.z)*t + (2*p0.z-5*p1.z+4*p2.z-p3.z)*t2 + (-p0.z+3*p1.z-3*p2.z+p3.z)*t3);
}

function catmullRomScalar(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2*p1 + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
}

export class NetworkSystem {
  constructor({ scene, playerTransform, playerVelocity, trickState }) {
    this.scene = scene;
    this.playerTransform = playerTransform;
    this.playerVelocity = playerVelocity;
    this.trickState = trickState;

    this._syncTimer = 0;
    this._lastSentPos = new THREE.Vector3(Infinity, Infinity, Infinity);
    this._lastSentRot = Infinity;
    this._interpPos = new THREE.Vector3();

    // socketId → { mesh, history: [{pos, rot, t}], popup, popupLife }
    this._remotePlayers = new Map();

    this._setupHandlers();
  }

  _setupHandlers() {
    networkManager.on('player_joined', ({ id, username, position, rotation, level, skinId }) => {
      if (this._remotePlayers.has(id)) return;
      this._addRemotePlayer(id, username, position, rotation, level, skinId);
    });

    networkManager.on('player_left', ({ id }) => {
      this._removeRemotePlayer(id);
    });

    networkManager.on('room_state', ({ players }) => {
      for (const p of players) {
        if (p.id === networkManager.socket?.id) continue;
        if (!this._remotePlayers.has(p.id)) {
          this._addRemotePlayer(p.id, p.username, p.position, p.rotation, p.level, p.skinId);
        }
      }
    });

    networkManager.on('player_update', ({ id, position, rotation }) => {
      const rp = this._remotePlayers.get(id);
      if (!rp || !position) return;
      rp.history.push({
        pos: new THREE.Vector3(position.x, position.y, position.z),
        rot: rotation ?? 0,
        t: Date.now(),
      });
      if (rp.history.length > MAX_HISTORY) rp.history.shift();
    });

    networkManager.on('player_trick', ({ id, name }) => {
      const rp = this._remotePlayers.get(id);
      if (rp) this._showTrickPopup(rp, name);
    });

    networkManager.on('player_skin', ({ id, skinId }) => {
      const rp = this._remotePlayers.get(id);
      if (!rp) return;
      this._applySkin(rp.mesh, skinId);
    });
  }

  _applySkin(mesh, skinId) {
    if (!skinId) return;
    const skin = SkaterModel.getSkinById(skinId);
    mesh.traverse((child) => {
      if (!child.isMesh) return;
      const n = child.name;
      if (n === 'torso' || n === 'leftArm' || n === 'rightArm') {
        child.material.color.setHex(skin.shirt);
      } else if (n === 'board') {
        child.material.color.setHex(skin.board);
      } else if (n === 'leftLeg' || n === 'rightLeg') {
        child.material.color.setHex(skin.pants);
      }
    });
  }

  _addRemotePlayer(id, username, position, rotation, level = 1, skinId = null) {
    const mesh = SkaterModel.build(level, skinId);
    const initPos = new THREE.Vector3(position?.x || 0, position?.y || 1, position?.z || 0);
    mesh.position.copy(initPos);
    this.scene.add(mesh);

    const label = this._makeLabel(username);
    mesh.add(label);

    const now = Date.now();
    // Pre-poblar historia con la posición inicial para que Catmull-Rom tenga puntos desde el inicio
    const initEntry = { pos: initPos.clone(), rot: rotation || 0, t: now };
    this._remotePlayers.set(id, {
      mesh,
      label,
      history: [initEntry, { ...initEntry, t: now - 50 }, { ...initEntry, t: now - 100 }, { ...initEntry, t: now - 150 }].reverse(),
      popup: null,
      popupLife: 0,
    });
  }

  _makeLabel(username) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.roundRect(4, 4, 248, 40, 6);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(username, 128, 30);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.position.y = 1.5;
    sprite.scale.set(2, 0.4, 1);
    return sprite;
  }

  _showTrickPopup(rp, trickName) {
    // Quitar popup anterior si existe
    if (rp.popup) {
      rp.mesh.remove(rp.popup);
      rp.popup.material.dispose();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 56;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
    ctx.roundRect(4, 4, 312, 48, 8);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`✨ ${trickName}`, 160, 34);

    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.position.y = 2.5;
    sprite.scale.set(2.8, 0.5, 1);

    rp.mesh.add(sprite);
    rp.popup = sprite;
    rp.popupLife = 2.0; // segundos de vida
  }

  _removeRemotePlayer(id) {
    const rp = this._remotePlayers.get(id);
    if (!rp) return;
    this.scene.remove(rp.mesh);
    this._remotePlayers.delete(id);
  }

  update(dt) {
    // Interpolar posiciones remotas (Catmull-Rom)
    const renderTime = Date.now() - INTERP_DELAY_MS;
    for (const rp of this._remotePlayers.values()) {
      const h = rp.history;
      if (h.length >= 2) {
        // Buscar el segmento que contiene renderTime
        let i1 = h.length - 1;
        for (let i = 1; i < h.length; i++) {
          if (h[i].t >= renderTime) { i1 = i; break; }
        }
        const i0 = Math.max(0, i1 - 1);
        const prev = h[i0], next = h[i1];
        const span = next.t - prev.t;
        const rawT = span > 0 ? (renderTime - prev.t) / span : 1;
        const t = Math.max(0, Math.min(1, rawT));

        if (h.length >= 4 && i0 > 0 && i1 < h.length - 1) {
          // Catmull-Rom completo: 4 puntos
          catmullRomVec3(h[i0-1].pos, prev.pos, next.pos, h[i1+1]?.pos ?? next.pos, t, this._interpPos);
          rp.mesh.rotation.y = catmullRomScalar(h[i0-1].rot, prev.rot, next.rot, h[i1+1]?.rot ?? next.rot, t);
        } else {
          // Fallback: lerp lineal
          this._interpPos.lerpVectors(prev.pos, next.pos, t);
          rp.mesh.rotation.y = prev.rot + (next.rot - prev.rot) * t;
        }
        rp.mesh.position.copy(this._interpPos);
      }

      // Fade out y subida del popup de trick
      if (rp.popup && rp.popupLife > 0) {
        rp.popupLife -= dt;
        rp.popup.position.y = 2.5 + (2.0 - rp.popupLife) * 0.4; // sube levemente
        rp.popup.material.opacity = Math.max(0, rp.popupLife / 2.0);
        if (rp.popupLife <= 0) {
          rp.mesh.remove(rp.popup);
          rp.popup.material.dispose();
          rp.popup = null;
        }
      }
    }

    // Enviar estado propio — delta compression
    this._syncTimer += dt;
    if (this._syncTimer >= SYNC_INTERVAL && networkManager.socket?.connected) {
      this._syncTimer = 0;
      const pos = this.playerTransform.position;
      const rot = this.playerTransform.rotation.y;

      const moved = pos.distanceTo(this._lastSentPos);
      const rotated = Math.abs(rot - this._lastSentRot);

      if (moved >= DELTA_THRESHOLD || rotated >= 0.05) {
        this._lastSentPos.copy(pos);
        this._lastSentRot = rot;
        networkManager.sendPlayerUpdate({
          position: { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) },
          rotation: +rot.toFixed(3),
          state: this.trickState.state,
        });
      }
    }
  }

  dispose() {
    for (const id of this._remotePlayers.keys()) {
      this._removeRemotePlayer(id);
    }
  }
}
