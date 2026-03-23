import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './middleware/errorHandler';
import { memoriesRouter } from './routes/memories';
import { briefingsRouter } from './routes/briefings';
import { usersRouter } from './routes/users';
import { caregiversRouter } from './routes/caregivers';
import { remindersRouter } from './routes/reminders';

export function createApp() {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — restrict to known origins in production; open in dev for Expo Go on-device
  app.use(
    cors({
      origin: process.env['NODE_ENV'] === 'production'
        ? ['https://app.lighthouse.care']
        : true, // Allow all origins in development (Expo Go on LAN)
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting — important for HIPAA: prevents enumeration attacks
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Health check — unauthenticated, used by ECS health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // All routes below require auth
  app.use(authMiddleware);
  app.use(auditMiddleware);

  app.use('/api/memories', memoriesRouter);
  app.use('/api/briefings', briefingsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/caregivers', caregiversRouter);
  app.use('/api/reminders', remindersRouter);

  app.use(errorHandler);

  return app;
}
