import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * AppError — throw this anywhere in the app to return a structured API error.
 *
 * @example
 *   throw new AppError('ERR-FEE-001', 'Payment gateway timeout.', 502);
 *   throw new AppError('ERR-AUTH-004', 'Insufficient permissions.', 403);
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Global error handler middleware.
 * Must be registered LAST in Express, after all routes.
 *
 * Returns a consistent JSON shape:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERR-MODULE-NNN",
 *     "message": "Human-readable description",
 *     "error_id": "uuid-for-log-tracing",
 *     "timestamp": "ISO string"
 *   }
 * }
 *
 * The error_id is logged server-side so any developer can grep logs for it.
 * Clients should show "Error ID: [id] — contact IT support" to users.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const error_id = uuidv4();

  // ── Zod validation errors (bad request body / params) ──
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    res.status(400).json({
      success: false,
      error: {
        code: 'ERR-VALIDATION',
        message: 'Validation failed. Check the errors field for details.',
        errors: fieldErrors,
        error_id,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // ── Known AppError ──
  if (err instanceof AppError) {
    logger.warn({
      error_id,
      code: err.code,
      message: err.message,
      user_id: (req as any).user?.user_id ?? 'unauthenticated',
      method: req.method,
      url: req.originalUrl,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        error_id,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // ── Unexpected error ── log full stack
  const unknownErr = err as Error;
  logger.error({
    error_id,
    code: 'ERR-SYS-001',
    message: unknownErr?.message ?? 'Unknown error',
    stack: unknownErr?.stack,
    user_id: (req as any).user?.user_id ?? 'unauthenticated',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'ERR-SYS-001',
      message: 'An unexpected error occurred. Please contact IT support.',
      error_id,
      timestamp: new Date().toISOString(),
    },
  });
}
