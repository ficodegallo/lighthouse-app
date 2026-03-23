import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger';

const client = new Anthropic();

export interface BriefingSection {
  title: string;
  content: string;
}

export interface BriefingContent {
  greeting: string;
  sections: BriefingSection[];
  /** Full concatenated text for TTS — greeting + all sections */
  fullText: string;
}

interface MemoryInput {
  type: string;
  horizon: string;
  summary: string;
}

const SYSTEM_PROMPT = `You are Lighthouse, a warm and caring memory companion for someone living with Alzheimer's.

Your job is to write a gentle, personalized morning briefing for the patient. The briefing should feel like a warm letter from a trusted friend — grounding, reassuring, and full of love.

You will receive the patient's name, today's date, and their active memories. Write a briefing in three sections:

1. **Today** — What's happening today: appointments, tasks, medications. If nothing is scheduled, offer a warm, peaceful note about the day.
2. **This Week** — What's coming up in the next few days. Keep it simple and reassuring.
3. **Remember** — One or two meaningful life memories, identity anchors, or important people facts. Help them feel connected to who they are.

Guidelines:
- Speak directly to the person ("Today you have...", "This week, remember that...")
- Warm, calm, simple language — never clinical, never alarming
- Each section should be 2–4 sentences
- End the briefing on a positive, loving note

Respond ONLY with valid JSON — no explanation, no markdown, no code fences:
{
  "greeting": "string (a one-sentence warm greeting using their name and today's date)",
  "sections": [
    { "title": "Today", "content": "string" },
    { "title": "This Week", "content": "string" },
    { "title": "Remember", "content": "string" }
  ]
}`;

export async function runBriefingComposerAgent(
  patientName: string,
  date: Date,
  memories: MemoryInput[]
): Promise<BriefingContent> {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const todayMems = memories.filter((m) => m.horizon === 'Today');
  const weekMems = memories.filter((m) => m.horizon === 'ThisWeek');
  const alwaysMems = memories.filter((m) => m.horizon === 'Always');

  const memoriesText = [
    todayMems.length
      ? `TODAY:\n${todayMems.map((m) => `- [${m.type}] ${m.summary}`).join('\n')}`
      : 'TODAY: Nothing scheduled.',
    weekMems.length
      ? `THIS WEEK:\n${weekMems.map((m) => `- [${m.type}] ${m.summary}`).join('\n')}`
      : 'THIS WEEK: Nothing coming up.',
    alwaysMems.length
      ? `LIFE MEMORIES & PEOPLE:\n${alwaysMems.map((m) => `- [${m.type}] ${m.summary}`).join('\n')}`
      : 'LIFE MEMORIES: None saved yet.',
  ].join('\n\n');

  const userMessage = `Patient name: ${patientName}\nToday's date: ${dateStr}\n\nMemories:\n${memoriesText}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = message.content[0];
    if (raw?.type !== 'text') throw new Error('Unexpected response type');

    const parsed: { greeting: string; sections: BriefingSection[] } = JSON.parse(raw.text);

    const fullText = [
      parsed.greeting,
      ...parsed.sections.map((s) => `${s.title}. ${s.content}`),
    ].join(' ');

    return { ...parsed, fullText };
  } catch (err) {
    logger.error('BriefingComposerAgent failed', { error: (err as Error).message });

    // Graceful fallback briefing
    const fallback: BriefingContent = {
      greeting: `Good morning, ${patientName}. Today is ${dateStr}.`,
      sections: [
        {
          title: 'Today',
          content: todayMems.length
            ? todayMems.map((m) => m.summary).join(' ')
            : 'You have a peaceful day ahead. Take it one moment at a time.',
        },
        {
          title: 'This Week',
          content: weekMems.length
            ? weekMems.map((m) => m.summary).join(' ')
            : 'Nothing urgent coming up this week. Rest and enjoy your time.',
        },
        {
          title: 'Remember',
          content: alwaysMems.length
            ? alwaysMems[0].summary
            : 'You are loved, and the people around you are here for you.',
        },
      ],
      fullText: '',
    };
    fallback.fullText = [
      fallback.greeting,
      ...fallback.sections.map((s) => `${s.title}. ${s.content}`),
    ].join(' ');

    return fallback;
  }
}
