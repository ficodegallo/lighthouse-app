import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { UnauthorizedError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env['AWS_COGNITO_USER_POOL_ID']!,
  tokenUse: 'access',
  clientId: process.env['AWS_COGNITO_CLIENT_ID']!,
});

export interface AuthenticatedRequest extends Request {
  userId: string;
  cognitoId: string;
  userRole: string;
  /** If the authenticated user is a caregiver, this is the patient they're acting on */
  patientId?: string;
}

const DEV_COGNITO_ID = 'dev-user-local';

/**
 * Upserts a local dev patient user and returns their ID.
 * Only called in development — never reaches production.
 */
async function getOrCreateDevUser(): Promise<{ id: string; role: string }> {
  const user = await prisma.user.upsert({
    where: { cognitoId: DEV_COGNITO_ID },
    create: {
      cognitoId: DEV_COGNITO_ID,
      name: 'Dev Patient',
      email: 'dev@lighthouse.local',
      role: 'patient',
      timezone: 'America/Chicago',
    },
    update: {},
    select: { id: true, role: true },
  });
  return user;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // ── Dev bypass ───────────────────────────────────────────────────────────────
  // In development, any request without a real Bearer token (or with the
  // literal token "dev") is automatically authenticated as the local dev user.
  // This block is unreachable in production (NODE_ENV guard).
  if (process.env['NODE_ENV'] !== 'production') {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || token === 'dev') {
      try {
        const user = await getOrCreateDevUser();
        const authReq = req as AuthenticatedRequest;
        authReq.userId = user.id;
        authReq.cognitoId = DEV_COGNITO_ID;
        authReq.userRole = user.role;
        next();
        return;
      } catch (err) {
        logger.error('Dev user upsert failed', { error: (err as Error).message });
        next(new UnauthorizedError('Dev auth failed — is the database running?'));
        return;
      }
    }
  }

  // ── Production: full Cognito JWT verification ────────────────────────────────
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing authorization header');
    }

    const token = authHeader.slice(7);
    const payload = await verifier.verify(token);
    const cognitoId = payload.sub;

    const user = await prisma.user.findUnique({
      where: { cognitoId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const authReq = req as AuthenticatedRequest;
    authReq.userId = user.id;
    authReq.cognitoId = cognitoId;
    authReq.userRole = user.role;

    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    logger.warn('Auth verification failed', { error: (err as Error).message });
    next(new UnauthorizedError());
  }
}

/**
 * Middleware that verifies a caregiver has access to a patient.
 * Attaches patientId to the request.
 */
export function requireCaregiverAccess(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  const patientId = req.params['patientId'] ?? req.body.patientId;

  if (authReq.userRole === 'patient') {
    // Patients can only access their own data
    authReq.patientId = authReq.userId;
    next();
    return;
  }

  if (!patientId) {
    next(new UnauthorizedError('patientId required for caregiver requests'));
    return;
  }

  // Verify caregiver has a care circle relationship with this patient
  prisma.careCircle
    .findFirst({
      where: {
        patientId,
        caregiverId: authReq.userId,
      },
      select: { role: true },
    })
    .then((circle) => {
      if (!circle) {
        next(new UnauthorizedError('Not authorized for this patient'));
        return;
      }
      authReq.patientId = patientId;
      next();
    })
    .catch(next);
}
