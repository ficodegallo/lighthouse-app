import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';

export const briefingsRouter = Router();

// GET /api/briefings/today — get today's briefing for the authenticated patient
briefingsRouter.get('/today', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const briefing = await prisma.briefing.findFirst({
      where: {
        userId: authReq.userId,
        date: today,
      },
    });

    if (!briefing) throw new NotFoundError('Briefing');

    // Mark as opened
    if (!briefing.openedAt) {
      await prisma.briefing.update({
        where: { id: briefing.id },
        data: { openedAt: new Date() },
      });
    }

    res.json({ success: true, data: briefing });
  } catch (err) {
    next(err);
  }
});

// GET /api/briefings — list recent briefings
briefingsRouter.get('/', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const briefings = await prisma.briefing.findMany({
      where: { userId: authReq.userId },
      orderBy: { date: 'desc' },
      take: 30,
      select: {
        id: true,
        date: true,
        deliveredAt: true,
        openedAt: true,
        audioPlayedAt: true,
        audioUrl: true,
      },
    });

    res.json({ success: true, data: briefings });
  } catch (err) {
    next(err);
  }
});

// POST /api/briefings/:id/audio-played — track audio engagement
briefingsRouter.post('/:id/audio-played', async (req, res, next) => {
  try {
    await prisma.briefing.update({
      where: { id: req.params['id'] },
      data: { audioPlayedAt: new Date() },
    });
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
});
