import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { randomUUID } from 'crypto';

export const caregiversRouter = Router();

// GET /api/caregivers — list caregivers in the patient's care circle
caregiversRouter.get('/', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.userRole !== 'patient') throw new ForbiddenError('Patients only');

    const members = await prisma.careCircle.findMany({
      where: { patientId: authReq.userId },
      include: {
        caregiver: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
});

// POST /api/caregivers/invite — invite a caregiver by email
caregiversRouter.post('/invite', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.userRole !== 'patient') throw new ForbiddenError('Patients only');

    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(['admin', 'contributor', 'viewer']).default('contributor'),
    });

    const body = schema.parse(req.body);
    const inviteToken = randomUUID();

    // Check if this caregiver already has an account
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      // Direct link — no token needed
      const circle = await prisma.careCircle.upsert({
        where: {
          patientId_caregiverId: {
            patientId: authReq.userId,
            caregiverId: existingUser.id,
          },
        },
        create: {
          patientId: authReq.userId,
          caregiverId: existingUser.id,
          role: body.role as any,
        },
        update: { role: body.role as any },
      });
      res.status(201).json({ success: true, data: { careCircle: circle, invited: false } });
      return;
    }

    // Store pending invite — in production, send email via SES with the token
    // For now, return the token so the frontend can display it
    res.status(201).json({
      success: true,
      data: {
        inviteToken,
        email: body.email,
        message: `Invite link: /join?token=${inviteToken}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/caregivers/accept-invite — caregiver accepts invite via token
caregiversRouter.post('/accept-invite', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.userRole !== 'caregiver') throw new ForbiddenError('Caregivers only');

    const { token } = z.object({ token: z.string() }).parse(req.body);

    const circle = await prisma.careCircle.findFirst({
      where: { inviteToken: token },
    });

    if (!circle) throw new NotFoundError('Invite');

    const updated = await prisma.careCircle.update({
      where: { id: circle.id },
      data: {
        caregiverId: authReq.userId,
        inviteToken: null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
