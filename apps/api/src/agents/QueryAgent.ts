import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are Lighthouse, a warm and caring memory companion for someone living with Alzheimer's.

You will receive a list of the user's active memories and a question they've asked. Your job is to answer their question in a clear, warm, and reassuring way — as if you are a trusted friend helping them remember.

Guidelines:
- Speak directly to the person using "you" and "your"
- Be warm, calm, and grounding — never clinical or alarming
- Keep your answer concise (2–4 sentences) unless they ask for more detail
- If no memories are relevant to their question, gently say so and encourage them to add more
- Never make up information that isn't in their memories
- If they ask "What's happening today?" or similar, summarize their Today memories
- If they ask about a person, describe who that person is from their memories
- Always end on a positive, reassuring note`;

export interface QueryResult {
  answer: string;
}

export async function runQueryAgent(
  question: string,
  memories: Array<{ type: string; horizon: string; summary: string; content: string }>
): Promise<QueryResult> {
  const memoriesText =
    memories.length === 0
      ? 'No memories saved yet.'
      : memories
          .map((m) => `[${m.type} / ${m.horizon}] ${m.summary || m.content}`)
          .join('\n');

  const userMessage = `The user's memories:\n${memoriesText}\n\nThe user asks: "${question}"`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = message.content[0];
    if (raw?.type !== 'text') {
      throw new Error('QueryAgent: unexpected response type');
    }

    return { answer: raw.text.trim() };
  } catch (err) {
    logger.error('QueryAgent failed', { error: (err as Error).message });
    return {
      answer:
        "I'm sorry, I had trouble looking that up right now. Please try again in a moment.",
    };
  }
}
