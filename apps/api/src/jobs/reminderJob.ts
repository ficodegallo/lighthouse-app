import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const ESCALATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes unacknowledged → escalate

/**
 * Sends an Expo push notification to a single token.
 */
async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'high' }),
  });
}

/**
 * Reminder job — runs every 5 minutes.
 *
 * Pass 1: Deliver pending reminders whose triggerAt is now or in the next 5 minutes.
 * Pass 2: Escalate delivered+unacknowledged reminders to caregivers after 15 minutes.
 */
export async function runReminderJob() {
  const now = new Date();
  const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);
  const escalationCutoff = new Date(now.getTime() - ESCALATION_WINDOW_MS);

  // ── Pass 1: Deliver due reminders ────────────────────────────────────────────
  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: 'pending',
      triggerAt: { gte: now, lte: fiveMinutesAhead },
    },
    include: {
      user: { select: { expoPushToken: true, name: true } },
    },
  });

  for (const reminder of dueReminders) {
    try {
      if (reminder.user.expoPushToken) {
        await sendPush(
          reminder.user.expoPushToken,
          'Reminder',
          reminder.message,
          { reminderId: reminder.id, screen: 'home' }
        );
      }
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'delivered' },
      });
      logger.info('Reminder delivered', { reminderId: reminder.id });
    } catch (err) {
      logger.error('Failed to deliver reminder', {
        reminderId: reminder.id,
        error: (err as Error).message,
      });
    }
  }

  // ── Pass 2: Escalate unacknowledged reminders to caregivers ──────────────────
  const unacknowledged = await prisma.reminder.findMany({
    where: {
      status: 'delivered',
      updatedAt: { lte: escalationCutoff },
      escalationLevel: { lt: 3 }, // max 3 escalations
    },
    include: {
      user: {
        select: {
          name: true,
          careCircleAsPatient: {
            include: {
              caregiver: { select: { expoPushToken: true, name: true } },
            },
          },
        },
      },
    },
  });

  for (const reminder of unacknowledged) {
    const caregivers = reminder.user.careCircleAsPatient
      .map((cc) => cc.caregiver)
      .filter((c) => !!c.expoPushToken);

    for (const caregiver of caregivers) {
      try {
        await sendPush(
          caregiver.expoPushToken!,
          `Reminder for ${reminder.user.name}`,
          `${reminder.user.name} may need a reminder: ${reminder.message}`,
          { reminderId: reminder.id, patientName: reminder.user.name }
        );
      } catch (err) {
        logger.warn('Caregiver escalation push failed', { error: (err as Error).message });
      }
    }

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: 'escalated',
        escalationLevel: { increment: 1 },
      },
    });

    logger.info('Reminder escalated to caregivers', {
      reminderId: reminder.id,
      caregiverCount: caregivers.length,
    });
  }

  if (dueReminders.length || unacknowledged.length) {
    logger.info('Reminder job complete', {
      delivered: dueReminders.length,
      escalated: unacknowledged.length,
    });
  }
}
