import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/scores/:mapId — Top 20 scores globales del mapa
router.get('/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const scores = await prisma.score.findMany({
      where: { mapId },
      orderBy: { score: 'desc' },
      take: 20,
      select: {
        score: true,
        tricks: true,
        user: { select: { username: true, level: true } },
      },
    });

    res.json({
      mapId,
      scores: scores.map((s, i) => ({
        rank: i + 1,
        username: s.user.username,
        level: s.user.level,
        score: s.score,
        tricks: s.tricks,
      })),
    });
  } catch (err) {
    console.error('[Scores] error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
