/**
 * server/src/index.js
 *
 * Sprint 2: Express + Socket.io + Auth + Rooms
 */
import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyToken } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import { RoomManager } from './rooms/RoomManager.js';
import scoresRouter from './routes/scores.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const server = http.createServer(app);

// En dev: cualquier localhost. En prod: mismo origen (el server sirve el cliente).
const allowedOrigins = IS_PROD
  ? (process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : true)
  : /^http:\/\/localhost:\d+$/;

const io = new SocketServer(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

// --- Middleware ---
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// --- Servir cliente estático en producción ---
if (IS_PROD) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
}

// --- REST Routes ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, rooms: roomManager.getStats() });
});
app.use('/api/auth', authRouter);
app.use('/api/scores', scoresRouter);

// --- Room Manager ---
const roomManager = new RoomManager(io);

// --- Socket.io ---
// Middleware: autenticación opcional por token
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.user = verifyToken(token);
    } catch {
      // token inválido — conectar como anónimo
    }
  }
  next();
});

io.on('connection', (socket) => {
  const username = socket.user?.username || `Anon_${socket.id.slice(0, 4)}`;
  console.log(`[Socket] ${username} conectado (${socket.id})`);

  // Unirse a sala pública
  socket.on('join_public', ({ mapId }) => {
    const room = roomManager.joinPublic(socket, { mapId, username });
    console.log(`[Room] ${username} → sala pública ${room.id} (${room.players.size} jugadores)`);
  });

  // Crear sala privada
  socket.on('create_private', ({ mapId }) => {
    const room = roomManager.createPrivate(socket, { mapId, username });
    socket.emit('room_created', { code: room.code, roomId: room.id });
    console.log(`[Room] ${username} creó sala privada ${room.code}`);
  });

  // Unirse a sala privada
  socket.on('join_private', ({ code }) => {
    const result = roomManager.joinPrivate(socket, { code, username });
    if (result.error) {
      socket.emit('join_error', { error: result.error });
    } else {
      console.log(`[Room] ${username} → sala privada ${code}`);
    }
  });

  // Actualización de posición/estado del jugador (cada frame o cada X ms)
  socket.on('player_update', (data) => {
    roomManager.updatePlayer(socket, data);
  });

  // Trick ejecutado
  socket.on('player_trick', (data) => {
    roomManager.broadcastTrick(socket, data);
  });

  // Cambio de skin
  socket.on('player_skin', ({ skinId }) => {
    roomManager.updateSkin(socket, skinId);
  });

  // Chat
  socket.on('chat_message', ({ text }) => {
    if (!socket._roomId || !text?.trim()) return;
    io.to(socket._roomId).emit('chat_message', {
      id: socket.id,
      username,
      text: text.slice(0, 200),
      ts: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    roomManager.leave(socket);
    console.log(`[Socket] ${username} desconectado`);
  });
});

// --- SPA fallback (producción) ---
if (IS_PROD) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.get('/*splat', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// --- Start ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[Server] http://localhost:${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/api/health`);
});
