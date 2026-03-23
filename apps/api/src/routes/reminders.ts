import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { z } from 'zod';

export const remindersRouter = Router();

const REMINDER_TYPES = ['appointment', 'medication', 'routine', 'day_before'] as const;

// GET /api/reminders — list upcoming reminders for the user
remindersRouter.get('/', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const reminders = await prisma.reminder.findMany({
      where: {
        userId: authReq.userId,
        status: { in: ['pending', 'delivered'] },
      },
      orderBy: { triggerAt: 'asc' },
      take: 20,
    });

    res.json({ success: true, data: reminders });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders — create a reminder manually
remindersRouter.post('/', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const schema = z.object({
      memoryId: z.string().uuid(),
      triggerAt: z.string().datetime(),
      type: z.enum(REMINDER_TYPES),
      message: z.string().min(1).max(500),
    });

    const body = schema.parse(req.body);

    // Verify the memory belongs to this user
    const memory = await prisma.memory.findUnique({ where: { id: body.memoryId } });
    if (!memory) throw new NotFoundError('Memory');
    if (memory.userId !== authReq.userId && authReq.userRole !== 'caregiver') {
      throw new ForbiddenError();
    }

    const reminder = await prisma.reminder.create({
      data: {
        memoryId: body.memoryId,
        userId: memory.userId,
        triggerAt: new Date(body.triggerAt),
        type: body.type as any,
        message: body.message,
      },
    });

    res.status(201).json({ success: true, data: reminder });
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

// DELETE /api/reminders/:id — cancel a pending reminder
remindersRouter.delete('/:id', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const reminder = await prisma.reminder.findUnique({ where: { id: req.params['id'] } });

    if (!reminder) throw new NotFoundError('Reminder');
    if (reminder.userId !== authReq.userId && authReq.userRole !== 'caregiver') {
      throw new ForbiddenError();
    }

    await prisma.reminder.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, data: { id: req.params['id'] } });
  } catch (err) {
    next(err);
  }
});
