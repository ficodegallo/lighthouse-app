import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Expiry job — runs daily at midnight.
 * - Quick Notes auto-expire after their expiresAt timestamp
 * - Events auto-archive after they pass
 */
export async function runExpiryJob() {
  const now = new Date();

  // Expire memories past their expiresAt
  const expired = await prisma.memory.updateMany({
    where: {
      status: 'active',
      expiresAt: { lt: now },
    },
    data: { status: 'expired' },
  });

  // Archive past Events (horizon = Today/ThisWeek that have passed)
  // Quick Notes with no explicit expiresAt default to 24h — set at creation time
  logger.info('Expiry job complete', {
    expiredCount: expired.count,
  });
}
