import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error.middleware';

export interface JwtPayload {
  user_id: string;
  username: string;
  role: string;
  role_id: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * requireAuth — verifies the JWT access token from HttpOnly cookie.
 * Attaches decoded payload to req.user for downstream use.
 *
 * @throws AppError ERR-AUTH-003 if token is missing or expired
 * @throws AppError ERR-AUTH-001 if token is invalid
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token;

  if (!token) {
    throw new AppError('ERR-AUTH-003', 'Session expired. Please log in again.', 401);
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('ERR-AUTH-003', 'Session expired. Please log in again.', 401);
    }
    throw new AppError('ERR-AUTH-001', 'Invalid session. Please log in again.', 401);
  }
}

/**
 * requireRole — checks that the authenticated user has one of the allowed roles.
 * Must be used AFTER requireAuth.
 *
 * @param roles Array of allowed role names e.g. ['SUPER_ADMIN', 'HOD']
 * @throws AppError ERR-AUTH-004 if user's role is not in the allowed list
 *
 * @example
 *   router.get('/fee/collection',
 *     requireAuth,
 *     requireRole(['ACCOUNT_OFFICER', 'SUPER_ADMIN', 'PRINCIPAL']),
 *     feeController.getCollection
 *   );
 */
export function requireRole(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('ERR-AUTH-003', 'Not authenticated.', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(
        'ERR-AUTH-004',
        'You do not have permission to perform this action.',
        403,
      );
    }

    next();
  };
}
