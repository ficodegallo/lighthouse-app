import { logger } from '../lib/logger';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Default voice — "Rachel" (warm, clear, calm)
// Can be overridden per-user via voiceId preference
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export interface SynthesisResult {
  /** data URI (dev) or S3 signed URL (prod) */
  audioUrl: string;
  /** S3 key — null in dev */
  audioS3Key: string | null;
}

/**
 * Converts briefing text to audio via ElevenLabs.
 *
 * Dev: Returns a base64 data URI directly (no S3).
 * Prod: Would upload to S3 and return a signed URL (stub — wired in infra sprint).
 */
export async function runVoiceSynthesisAgent(
  text: string,
  voiceId?: string,
  speechRate?: number
): Promise<SynthesisResult> {
  const apiKey = process.env['ELEVENLABS_API_KEY'];
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  const voice = voiceId ?? DEFAULT_VOICE_ID;
  // ElevenLabs stability=0.5, similarity_boost=0.75 → warm, consistent voice
  const stability = 0.5;
  const similarityBoost = 0.75;
  // speechRate maps to speaking_rate (0.25–4.0); default 0.85x → slightly slower for clarity
  const speakingRate = speechRate ?? 0.85;

  logger.info('VoiceSynthesisAgent: calling ElevenLabs', {
    voiceId: voice,
    textLength: text.length,
  });

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        speaking_rate: speakingRate,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  if (process.env['NODE_ENV'] !== 'production') {
    // Dev: return base64 data URI — no S3 needed
    const base64 = audioBuffer.toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64}`;
    logger.info('VoiceSynthesisAgent: returning base64 audio (dev mode)', {
      bytes: audioBuffer.length,
    });
    return { audioUrl, audioS3Key: null };
  }

  // Production: upload to S3 (wired in infra sprint)
  // Placeholder — will throw in prod until S3 is connected
  throw new Error('S3 upload not yet configured for production');
}
