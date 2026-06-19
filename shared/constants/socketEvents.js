/**
 * shared/constants/socketEvents.js
 * 
 * Nombres de todos los eventos Socket.io usados en el juego.
 * Cliente y servidor importan desde acá para evitar typos.
 */
export const SOCKET_EVENTS = {
  // Cliente → Servidor
  ROOM_JOIN: 'room:join',
  ROOM_CREATE: 'room:create',
  ROOM_LEAVE: 'room:leave',
  PLAYER_MOVE: 'player:move',
  PLAYER_TRICK: 'player:trick',

  // Servidor → Cliente
  ROOM_STATE: 'room:state',
  ROOM_PLAYER_JOINED: 'room:player-joined',
  ROOM_PLAYER_LEFT: 'room:player-left',
  PLAYER_UPDATE: 'player:update',
  SCORE_UPDATE: 'score:update',
};
