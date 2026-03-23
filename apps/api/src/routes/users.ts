import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

export const usersRouter = Router();

// GET /api/users/me — get current user's profile
usersRouter.get('/me', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const user = await prisma.user.findUnique({
      where: { id: authReq.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        briefingTime: true,
        speechRate: true,
        voiceId: true,
        complexityLevel: true,
        timezone: true,
        autoPlayAudio: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/me/preferences — update preferences
usersRouter.patch('/me/preferences', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const prefsSchema = z.object({
      briefingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      speechRate: z.number().min(0.5).max(2.0).optional(),
      voiceId: z.string().optional(),
      complexityLevel: z.enum(['full', 'simplified', 'audio_only']).optional(),
      timezone: z.string().optional(),
      autoPlayAudio: z.boolean().optional(),
    });

    const updates = prefsSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: authReq.userId },
      data: updates as any,
    });

    res.json({ success: true, data: { id: user.id, preferences: updates } });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/me/push-token — register Expo push token for notifications
usersRouter.post('/me/push-token', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

    await prisma.user.update({
      where: { id: authReq.userId },
      data: { expoPushToken: token },
    });

    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/register — called after Cognito signup to create internal user record
usersRouter.post('/register', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const schema = z.object({
      name: z.string().min(1).max(100),
      role: z.enum(['patient', 'caregiver']),
      timezone: z.string().default('America/New_York'),
    });

    const body = schema.parse(req.body);

    // Idempotent — if user already exists, return it
    const existing = await prisma.user.findUnique({
      where: { cognitoId: authReq.cognitoId },
    });

    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    const cognitoUser = await prisma.user.findUnique({
      where: { id: authReq.userId },
    });

    const user = await prisma.user.create({
      data: {
        cognitoId: authReq.cognitoId,
        name: body.name,
        email: cognitoUser?.email ?? '',
        role: body.role as any,
        timezone: body.timezone,
      },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
