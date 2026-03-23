import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * HIPAA Audit Log Middleware.
 * Records every authenticated request to the AuditLog table.
 * Logs action + resource IDs only — NO PHI/PII in the log record.
 */
export function auditMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;

  // Derive action from method + path, e.g. "POST /api/memories" → "memory.create"
  const action = deriveAction(req.method, req.path);

  // Write audit log asynchronously — don't block the request
  if (authReq.userId && action) {
    prisma.auditLog
      .create({
        data: {
          userId: authReq.userId,
          actorId: authReq.userId,
          action,
          resourceType: deriveResourceType(req.path),
          // resourceId is set after the handler resolves — this is a pre-log
          ipAddress: req.ip,
        },
      })
      .catch((err) => {
        // Never fail a request because of audit log failure, but always surface it
        logger.error('Audit log write failed', { action, error: (err as Error).message });
      });
  }

  next();
}

function deriveAction(method: string, path: string): string {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[1] ?? 'unknown'; // e.g. "memories"
  const singular = resource.replace(/s$/, ''); // "memory"

  const verbMap: Record<string, string> = {
    GET: 'read',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };
  const verb = verbMap[method] ?? method.toLowerCase();
  return `${singular}.${verb}`;
}

function deriveResourceType(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[1] ?? 'unknown';
  return resource.charAt(0).toUpperCase() + resource.slice(1, -1); // "Memories" → "Memory"
}
