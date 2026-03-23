import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { NotFoundError, ForbiddenError } from '../lib/errors';

export const remindersRouter = Router();

// GET /api/reminders — list pending reminders for the user
remindersRouter.get('/', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const reminders = await prisma.reminder.findMany({
      where: {
        userId: authReq.userId,
        status: { in: ['pending', 'delivered'] },
      },
      orderBy: { triggerAt: 'asc' },
    });

    res.json({ success: true, data: reminders });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/:id/acknowledge
remindersRouter.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const reminder = await prisma.reminder.findUnique({ where: { id: req.params['id'] } });

    if (!reminder) throw new NotFoundError('Reminder');
    if (reminder.userId !== authReq.userId) throw new ForbiddenError();

    const updated = await prisma.reminder.update({
      where: { id: req.params['id'] },
      data: { status: 'acknowledged' },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
