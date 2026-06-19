import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Anti-cheat: per-user cooldown para score submissions (30 segundos mínimo entre envíos)
const scoreCooldown = new Map(); // userId → timestamp
const SCORE_COOLDOWN_MS = 30_000;
const MAX_SCORE = 2_000_000; // score imposible legítimamente

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'El username debe tener entre 3 y 20 caracteres' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email: email.toLowerCase(), password: hash },
      select: { id: true, username: true, email: true, level: true, xp: true, highScore: true },
    });

    const token = signToken({ userId: user.id, username: user.username });
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('email') ? 'email' : 'username';
      return res.status(409).json({ error: `Ese ${field} ya está en uso` });
    }
    console.error('[Auth] register error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const token = signToken({ userId: user.id, username: user.username });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('[Auth] login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me  (requiere token)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, username: true, email: true, level: true, xp: true, highScore: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/score  (guardar score)
router.post('/score', requireAuth, async (req, res) => {
  try {
    const { score, mapId = 'plaza', tricks = 0 } = req.body;
    if (typeof score !== 'number' || score < 0) return res.status(400).json({ error: 'score inválido' });
    if (score > MAX_SCORE) {
      console.warn(`[AntiCheat] Score sospechoso de ${req.user.username}: ${score}`);
      return res.status(400).json({ error: 'Score rechazado' });
    }

    const now = Date.now();
    const lastSubmit = scoreCooldown.get(req.user.userId) || 0;
    if (now - lastSubmit < SCORE_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Muy pronto para enviar otro score' });
    }
    scoreCooldown.set(req.user.userId, now);

    await prisma.score.create({
      data: { userId: req.user.userId, score, mapId, tricks },
    });

    // Actualizar highScore y XP
    const xpGained = Math.floor(score / 10);
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const newXp = user.xp + xpGained;
    const newLevel = Math.floor(newXp / 1000) + 1;

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        xp: newXp,
        level: newLevel,
        highScore: Math.max(user.highScore, score),
      },
    });

    res.json({ ok: true, xpGained, newLevel });
  } catch (err) {
    console.error('[Auth] score error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/achievement  (registrar logro desbloqueado)
router.post('/achievement', requireAuth, async (req, res) => {
  try {
    const { achievementId } = req.body;
    if (!achievementId || typeof achievementId !== 'string') {
      return res.status(400).json({ error: 'achievementId requerido' });
    }

    await prisma.achievement.upsert({
      where: { userId_achievementId: { userId: req.user.userId, achievementId } },
      update: {},
      create: { userId: req.user.userId, achievementId },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth] achievement error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/auth/achievements  (obtener IDs de logros desbloqueados)
router.get('/achievements', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.achievement.findMany({
      where: { userId: req.user.userId },
      select: { achievementId: true, unlockedAt: true },
    });
    res.json({ achievements: rows });
  } catch (err) {
    console.error('[Auth] achievements get error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
