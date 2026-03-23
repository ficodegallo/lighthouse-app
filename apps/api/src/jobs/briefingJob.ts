import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { runBriefingComposerAgent } from '../agents/BriefingComposerAgent';
import { runVoiceSynthesisAgent } from '../agents/VoiceSynthesisAgent';

/**
 * Generates a morning briefing for a single patient.
 * Called by the daily cron job and the manual /generate dev endpoint.
 */
export async function generateBriefingForPatient(patientId: string): Promise<string> {
  const patient = await prisma.user.findUniqueOrThrow({
    where: { id: patientId },
    select: { id: true, name: true, speechRate: true, voiceId: true, timezone: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Idempotent — don't regenerate if one already exists today
  const existing = await prisma.briefing.findFirst({
    where: { userId: patientId, date: today },
  });
  if (existing) {
    logger.info('Briefing already exists for today', { patientId });
    return existing.id;
  }

  // Fetch up to 50 active memories
  const memories = await prisma.memory.findMany({
    where: { userId: patientId, status: 'active' },
    select: { type: true, horizon: true, summary: true, content: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const memoryInputs = memories.map((m) => ({
    type: m.type,
    horizon: m.horizon,
    summary: m.summary || m.content,
  }));

  // Generate briefing text
  const briefingContent = await runBriefingComposerAgent(patient.name, new Date(), memoryInputs);

  // Generate audio
  let audioUrl: string | null = null;
  let audioS3Key: string | null = null;

  try {
    const synthesis = await runVoiceSynthesisAgent(
      briefingContent.fullText,
      patient.voiceId ?? undefined,
      patient.speechRate
    );
    audioUrl = synthesis.audioUrl;
    audioS3Key = synthesis.audioS3Key;
  } catch (err) {
    // Audio failure should not block the text briefing
    logger.error('VoiceSynthesisAgent failed — saving text-only briefing', {
      error: (err as Error).message,
    });
  }

  // Persist briefing
  const briefing = await prisma.briefing.create({
    data: {
      userId: patientId,
      date: today,
      fullText: briefingContent.fullText,
      sectionsJson: JSON.stringify(briefingContent.sections),
      audioUrl,
      audioS3Key,
      deliveredAt: new Date(),
    },
  });

  // Send push notification if patient has a push token
  await sendBriefingNotification(patientId, patient.name);

  logger.info('Briefing generated', { patientId, briefingId: briefing.id, hasAudio: !!audioUrl });
  return briefing.id;
}

/**
 * Sends an Expo push notification to the patient when their briefing is ready.
 */
async function sendBriefingNotification(patientId: string, name: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: patientId },
    select: { expoPushToken: true },
  });

  if (!user?.expoPushToken) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.expoPushToken,
        title: 'Good morning',
        body: `Your morning briefing is ready, ${name.split(' ')[0]}.`,
        data: { screen: 'briefing' },
        sound: 'default',
        priority: 'normal',
      }),
    });
  } catch (err) {
    logger.warn('Push notification failed', { error: (err as Error).message });
  }
}

/**
 * Daily briefing job — runs at 5 AM, processes all patients.
 */
export async function runBriefingJob() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const patients = await prisma.user.findMany({
    where: {
      role: 'patient',
      briefings: { none: { date: today } },
    },
    select: { id: true, name: true },
  });

  logger.info('Briefing job: patients to process', { count: patients.length });

  for (const patient of patients) {
    try {
      await generateBriefingForPatient(patient.id);
    } catch (err) {
      logger.error('Failed to generate briefing for patient', {
        patientId: patient.id,
        error: (err as Error).message,
      });
    }
  }
}
