import cron from 'node-cron';
import { logger } from '../lib/logger';
import { runBriefingJob } from './briefingJob';
import { runReminderJob } from './reminderJob';
import { runExpiryJob } from './expiryJob';

export function startJobs() {
  // Generate morning briefings at 5:00 AM every day
  // Briefings are delivered at user-configured time (default 7:30 AM)
  cron.schedule('0 5 * * *', async () => {
    logger.info('Starting briefing generation job');
    try {
      await runBriefingJob();
    } catch (err) {
      logger.error('Briefing job failed', { error: (err as Error).message });
    }
  });

  // Check and fire pending reminders every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runReminderJob();
    } catch (err) {
      logger.error('Reminder job failed', { error: (err as Error).message });
    }
  });

  // Expire Quick Notes and archive past Events daily at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Starting expiry job');
    try {
      await runExpiryJob();
    } catch (err) {
      logger.error('Expiry job failed', { error: (err as Error).message });
    }
  });

  logger.info('Background jobs started');
}
