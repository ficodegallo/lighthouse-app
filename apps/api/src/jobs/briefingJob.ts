import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Briefing generation job — runs daily at 5 AM.
 * Full implementation wired in Sprint 4 when BriefingComposerAgent + ElevenLabs are built.
 * This stub identifies which patients need a briefing today.
 */
export async function runBriefingJob() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all active patients who don't yet have a briefing for today
  const patients = await prisma.user.findMany({
    where: {
      role: 'patient',
      briefings: {
        none: { date: today },
      },
    },
    select: { id: true, name: true, briefingTime: true, timezone: true },
  });

  logger.info('Briefing job: patients to process', { count: patients.length });

  // TODO (Sprint 4): For each patient, call BriefingComposerAgent + VoiceSynthesisAgent
  // and schedule push notification at briefingTime

  for (const patient of patients) {
    logger.info('Would generate briefing', { patientId: patient.id });
  }
}
