import { Router } from 'express';
import { AuthenticatedRequest, requireCaregiverAccess } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { runIntakeAgent } from '../agents/IntakeAgent';
import { runQueryAgent } from '../agents/QueryAgent';
import { z } from 'zod';

export const memoriesRouter = Router();

const MEMORY_TYPES = ['Event', 'Routine', 'LifeMemory', 'QuickNote', 'Person'] as const;
const HORIZONS = ['Today', 'ThisWeek', 'Always'] as const;

const createMemorySchema = z.object({
  content: z.string().min(1).max(5000),
  /** If omitted, IntakeAgent classifies automatically */
  type: z.enum(MEMORY_TYPES).optional(),
  horizon: z.enum(HORIZONS).optional(),
  expiresAt: z.string().datetime().optional(),
  /** Summary override — if provided, skips AI summary generation */
  summary: z.string().max(500).optional(),
  /** ISO datetime extracted by IntakeAgent — used to schedule reminders */
  extractedDateTime: z.string().datetime().optional(),
  patientId: z.string().uuid().optional(),
});

/** QuickNotes expire after 24 hours by default */
function defaultExpiresAt(type: string): Date | undefined {
  if (type === 'QuickNote') {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  return undefined;
}

// GET /api/memories — list patient's memories
memoriesRouter.get('/', requireCaregiverAccess, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const patientId = authReq.patientId ?? authReq.userId;
    const { horizon, status = 'active', type } = req.query;

    const memories = await prisma.memory.findMany({
      where: {
        userId: patientId,
        status: status as string,
        ...(horizon ? { horizon: horizon as string } : {}),
        ...(type ? { type: type as string } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        type: true,
        horizon: true,
        summary: true,
        createdBy: true,
        attributionLabel: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: memories });
  } catch (err) {
    next(err);
  }
});

// POST /api/memories/query — natural language question answered using the user's memories
memoriesRouter.post('/query', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { question } = z.object({ question: z.string().min(1).max(500) }).parse(req.body);

    const memories = await prisma.memory.findMany({
      where: { userId: authReq.userId, status: 'active' },
      select: { type: true, horizon: true, summary: true, content: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const result = await runQueryAgent(question, memories);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/memories/classify — AI classification preview (before save)
// Called by the mobile app immediately after voice/text capture to show confirmation card
memoriesRouter.post('/classify', async (req, res, next) => {
  try {
    const { content } = z.object({ content: z.string().min(1).max(5000) }).parse(req.body);
    const result = await runIntakeAgent(content);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/memories — create a confirmed memory
memoriesRouter.post('/', requireCaregiverAccess, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const patientId = authReq.patientId ?? authReq.userId;
    const body = createMemorySchema.parse(req.body);

    // If type/horizon not provided by client (i.e. user didn't override), run IntakeAgent
    let type = body.type;
    let horizon = body.horizon;
    let summary = body.summary;

    if (!type || !horizon || !summary) {
      const result = await runIntakeAgent(body.content);
      type = type ?? result.draft.type;
      horizon = horizon ?? result.draft.horizon;
      summary = summary ?? result.draft.summary;
    }

    const isCaregiver = authReq.userRole === 'caregiver';
    const caregiver = isCaregiver
      ? await prisma.user.findUnique({ where: { id: authReq.userId }, select: { name: true } })
      : null;

    const expiresAt = body.expiresAt
      ? new Date(body.expiresAt)
      : defaultExpiresAt(type);

    const memory = await prisma.memory.create({
      data: {
        userId: patientId,
        content: body.content,
        type: type as any,
        horizon: horizon as any,
        summary: summary!,
        createdBy: authReq.userId,
        attributionLabel: isCaregiver && caregiver ? `Added by ${caregiver.name}` : undefined,
        expiresAt,
      },
    });

    // Auto-create reminders for Event memories that have an extracted datetime
    if (type === 'Event' && body.extractedDateTime) {
      const eventTime = new Date(body.extractedDateTime);
      if (!isNaN(eventTime.getTime()) && eventTime > new Date()) {
        const reminderMessage = summary ?? body.content;

        // 30-minute-before reminder
        const thirtyMinBefore = new Date(eventTime.getTime() - 30 * 60 * 1000);
        if (thirtyMinBefore > new Date()) {
          await prisma.reminder.create({
            data: {
              memoryId: memory.id,
              userId: patientId,
              triggerAt: thirtyMinBefore,
              type: 'appointment',
              message: `30 minutes: ${reminderMessage}`,
            },
          });
        }

        // Day-before reminder for ThisWeek events
        if (horizon === 'ThisWeek') {
          const dayBefore = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000);
          if (dayBefore > new Date()) {
            await prisma.reminder.create({
              data: {
                memoryId: memory.id,
                userId: patientId,
                triggerAt: dayBefore,
                type: 'day_before',
                message: `Tomorrow: ${reminderMessage}`,
              },
            });
          }
        }
      }
    }

    res.status(201).json({ success: true, data: memory });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/memories/:id — update a memory
memoriesRouter.patch('/:id', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const memory = await prisma.memory.findUnique({ where: { id: req.params['id'] } });

    if (!memory) throw new NotFoundError('Memory');
    if (memory.userId !== authReq.userId && authReq.userRole !== 'caregiver') {
      throw new ForbiddenError();
    }

    const updateSchema = z.object({
      content: z.string().min(1).max(5000).optional(),
      type: z.enum(MEMORY_TYPES).optional(),
      horizon: z.enum(HORIZONS).optional(),
      status: z.enum(['active', 'archived', 'expired', 'flagged']).optional(),
      summary: z.string().max(500).optional(),
    });

    const updates = updateSchema.parse(req.body);
    const updated = await prisma.memory.update({
      where: { id: req.params['id'] },
      data: updates as any,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/memories/:id — soft-archive
memoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const memory = await prisma.memory.findUnique({ where: { id: req.params['id'] } });

    if (!memory) throw new NotFoundError('Memory');
    if (memory.userId !== authReq.userId && authReq.userRole !== 'caregiver') {
      throw new ForbiddenError();
    }

    await prisma.memory.update({
      where: { id: req.params['id'] },
      data: { status: 'archived' },
    });

    res.json({ success: true, data: { id: req.params['id'] } });
  } catch (err) {
    next(err);
  }
});
