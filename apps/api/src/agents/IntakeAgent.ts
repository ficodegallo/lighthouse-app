import Anthropic from '@anthropic-ai/sdk';
import { MemoryType, Horizon, MemoryDraft } from '@lighthouse/shared';
import { logger } from '../lib/logger';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the Intake Agent for Lighthouse, a memory companion app for Alzheimer's patients.

Your job is to classify a memory captured by a patient or caregiver and extract structured information from it.

Respond ONLY with a valid JSON object — no explanation, no markdown, no code fences.

JSON schema:
{
  "type": "Event" | "Routine" | "LifeMemory" | "QuickNote" | "Person",
  "horizon": "Today" | "ThisWeek" | "Always",
  "summary": string (1–2 warm, first-person sentences — e.g. "I have a doctor's appointment with Dr. Patel at 2 PM today."),
  "extractedDateTime": string | null (ISO 8601 if a date/time was mentioned, else null),
  "personNames": string[] (first names of people mentioned),
  "confidence": number (0.0–1.0)
}

Classification rules:
- Event: something happening at a specific time (appointments, birthdays, visits). Horizon = Today if today/tonight/this morning, ThisWeek if this week/tomorrow/soon, Always if recurring annually (like a birthday).
- Routine: recurring habits or health practices (medications, walks, exercises). Horizon = Always.
- LifeMemory: important life facts, identity anchors, family stories. Horizon = Always.
- QuickNote: transient, short-lived information (parking spot, where something was left, shopping item). Horizon = Today.
- Person: information specifically about who someone is (their role, relationship, details). Horizon = Always.

Tone: The summary should feel warm and personal, written from the patient's perspective ("I", "my"). Never clinical.`;

export interface IntakeResult {
  draft: MemoryDraft;
}

export async function runIntakeAgent(content: string): Promise<IntakeResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Classify this memory: "${content}"`,
      },
    ],
  });

  const raw = message.content[0];
  if (raw?.type !== 'text') {
    throw new Error('IntakeAgent: unexpected response type');
  }

  let parsed: {
    type: string;
    horizon: string;
    summary: string;
    extractedDateTime?: string | null;
    personNames?: string[];
    confidence: number;
  };

  try {
    parsed = JSON.parse(raw.text);
  } catch {
    logger.error('IntakeAgent: failed to parse Claude response');
    // Graceful fallback — don't crash the capture flow
    return {
      draft: {
        content,
        type: MemoryType.QuickNote,
        horizon: Horizon.Today,
        summary: content.slice(0, 200),
        personIds: [],
        confidence: 0.5,
      },
    };
  }

  const draft: MemoryDraft = {
    content,
    type: parsed.type as MemoryType,
    horizon: parsed.horizon as Horizon,
    summary: parsed.summary,
    extractedDateTime: parsed.extractedDateTime ?? undefined,
    personIds: [], // resolved to IDs in the Enrichment step (Sprint 3)
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
  };

  return { draft };
}
