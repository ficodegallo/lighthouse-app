import winston from 'winston';

const { combine, timestamp, json, errors } = winston.format;

/**
 * HIPAA-safe logger.
 * Rules:
 *  - Never log PHI/PII (names, emails, health data, memory content).
 *  - Log resource IDs and actions only.
 *  - All logs go to CloudWatch in production via stdout.
 */
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Strips any field that looks like PHI from a log payload.
 * This is a defense-in-depth measure — callers should never pass PHI.
 */
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const PHI_FIELDS = ['name', 'email', 'content', 'summary', 'message', 'fullText'];
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !PHI_FIELDS.includes(key))
  );
}
