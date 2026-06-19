/**
 * RoomManager.js
 *
 * Gestiona salas públicas y privadas.
 * - Salas públicas: pool de salas por mapa, max 30 jugadores.
 *   Cuando una sala se llena, se abre otra automáticamente.
 * - Salas privadas: código de 6 letras generado al crear.
 */

const MAX_PUBLIC = 30;
const MAX_PRIVATE = 8;
const MAPS = ['plaza', 'park', 'streets'];

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class RoomManager {
  constructor(io) {
    this.io = io;
    // mapId → [{ id, players: Map<socketId, playerData>, map }]
    this._public = new Map();
    // code → { id, players, map, maxPlayers }
    this._private = new Map();

    for (const map of MAPS) {
      this._public.set(map, [this._newPublicRoom(map)]);
    }
  }

  _newPublicRoom(mapId) {
    const id = `public_${mapId}_${Date.now()}`;
    return { id, mapId, players: new Map(), isPublic: true };
  }

  _newPrivateRoom(mapId, code) {
    const id = `private_${code}`;
    return { id, mapId, code, players: new Map(), isPublic: false };
  }

  // Encuentra o crea sala pública disponible para el mapa
  _getPublicRoom(mapId) {
    if (!this._public.has(mapId)) {
      this._public.set(mapId, [this._newPublicRoom(mapId)]);
    }
    const rooms = this._public.get(mapId);
    let room = rooms.find(r => r.players.size < MAX_PUBLIC);
    if (!room) {
      room = this._newPublicRoom(mapId);
      rooms.push(room);
    }
    return room;
  }

  joinPublic(socket, { mapId = 'plaza', username = 'Anon' }) {
    const room = this._getPublicRoom(mapId);
    this._join(socket, room, username);
    return room;
  }

  createPrivate(socket, { mapId = 'plaza', username = 'Anon' }) {
    const code = randomCode();
    const room = this._newPrivateRoom(mapId, code);
    this._private.set(code, room);
    this._join(socket, room, username);
    return room;
  }

  joinPrivate(socket, { code, username = 'Anon' }) {
    const room = this._private.get(code?.toUpperCase());
    if (!room) return { error: 'Sala no encontrada' };
    if (room.players.size >= MAX_PRIVATE) return { error: 'Sala llena' };
    this._join(socket, room, username);
    return room;
  }

  _join(socket, room, username) {
    if (socket._roomId) this.leave(socket);

    const playerData = {
      id: socket.id,
      username,
      level: socket.user?.level || 1,
      skinId: null,
      position: { x: 0, y: 1, z: 0 },
      rotation: 0,
      state: 'idle',
    };

    room.players.set(socket.id, playerData);
    socket._roomId = room.id;
    socket._room = room;
    socket.join(room.id);

    // Notificar a los demás
    socket.to(room.id).emit('player_joined', playerData);
    // Enviar lista de jugadores al nuevo
    socket.emit('room_state', {
      roomId: room.id,
      mapId: room.mapId,
      isPublic: room.isPublic,
      code: room.code || null,
      players: Array.from(room.players.values()),
    });
  }

  leave(socket) {
    const room = socket._room;
    if (!room) return;

    room.players.delete(socket.id);
    socket.leave(room.id);
    socket.to(room.id).emit('player_left', { id: socket.id });
    socket._roomId = null;
    socket._room = null;

    // Limpiar salas privadas vacías
    if (!room.isPublic && room.players.size === 0) {
      this._private.delete(room.code);
    }
  }

  // Actualizar posición de jugador (con anti-cheat de teleportación)
  updatePlayer(socket, data) {
    const room = socket._room;
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    // Anti-cheat: rechazar movimientos de más de 2m entre ticks (a 20Hz = 40 m/s máximo)
    if (data.position && player.position) {
      const dx = data.position.x - player.position.x;
      const dz = data.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 2.0) {
        console.warn(`[AntiCheat] Teleport de ${player.username}: ${dist.toFixed(2)}m`);
        return;
      }
    }

    Object.assign(player, data);
    socket.to(room.id).emit('player_update', { id: socket.id, ...data });
  }

  // Broadcast trick a la sala (con validación básica)
  broadcastTrick(socket, data) {
    // Anti-cheat: puntos máximos por trick (el 900 vale 1500)
    if (typeof data.points === 'number' && (data.points > 1500 || data.points < 0)) {
      console.warn(`[AntiCheat] Puntos de trick inválidos de ${socket.user?.username}: ${data.points}`);
      return;
    }
    // Nombre de trick: solo texto, sin HTML, max 50 chars
    if (typeof data.name !== 'string' || data.name.length > 50 || /</.test(data.name)) return;

    socket.to(socket._roomId).emit('player_trick', { id: socket.id, ...data });
  }

  // Actualizar/sincronizar skin del jugador
  updateSkin(socket, skinId) {
    const room = socket._room;
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    const VALID_SKINS = new Set(['red','blue','green','orange','purple','cyan','yellow','pink']);
    if (!VALID_SKINS.has(skinId)) return;
    player.skinId = skinId;
    socket.to(room.id).emit('player_skin', { id: socket.id, skinId });
  }

  getStats() {
    const publicRooms = [];
    for (const [mapId, rooms] of this._public) {
      for (const r of rooms) {
        if (r.players.size > 0) publicRooms.push({ mapId, id: r.id, players: r.players.size });
      }
    }
    return { public: publicRooms, private: this._private.size };
  }
}
