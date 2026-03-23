import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Reminder job — runs every 5 minutes.
 * Full push notification delivery wired in Sprint 5.
 */
export async function runReminderJob() {
  const now = new Date();
  const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);

  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: 'pending',
      triggerAt: {
        gte: now,
        lte: fiveMinutesAhead,
      },
    },
    include: {
      user: { select: { id: true } },
    },
  });

  if (dueReminders.length > 0) {
    logger.info('Reminder job: reminders due', { count: dueReminders.length });
  }

  // TODO (Sprint 5): Send push notifications via Expo / SNS
  // TODO (Sprint 5): Handle escalation if unacknowledged after threshold
}
