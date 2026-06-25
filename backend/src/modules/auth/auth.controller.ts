import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from './auth.types';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,           // Not accessible by JS — XSS protection
  secure: env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'strict' as const, // CSRF protection
  path: '/',
};

/**
 * AuthController — HTTP layer only.
 * Parses request, calls service, sets cookies, returns response.
 * No business logic here.
 */
export class AuthController {
  /**
   * POST /api/v1/auth/login
   * Body: { username, password }
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = LoginSchema.parse(req.body);
      const result = await authService.login(input);

      // Set tokens in HttpOnly cookies — never expose in response body
      res.cookie('access_token', result.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 60 * 60 * 1000, // 1 hour
      });

      res.cookie('refresh_token', result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          // Tokens are NOT in the response body — only in HttpOnly cookies
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Requires: authenticated user (requireAuth middleware)
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.user!.user_id);

      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', COOKIE_OPTIONS);

      res.status(200).json({ success: true, data: { message: 'Logged out successfully.' } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Body: { mobile_number }
   * Always returns 200 — doesn't reveal if number exists.
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mobile_number } = ForgotPasswordSchema.parse(req.body);
      const otp = await authService.generateOtp(mobile_number);

      // Only send SMS if OTP was generated (number exists in system)
      if (otp && env.ENABLE_SMS) {
        // SMS sending happens here — import smsService when building that utility
        // await smsService.send(mobile_number, `Your UniCampus OTP: ${otp}. Valid for 10 minutes.`);
      }

      // Always return 200 to prevent user enumeration attacks
      res.status(200).json({
        success: true,
        data: { message: 'If this number is registered, an OTP has been sent.' },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/reset-password
   * Body: { mobile_number, otp, new_password }
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = ResetPasswordSchema.parse(req.body);
      await authService.resetPassword(input);

      res.status(200).json({
        success: true,
        data: { message: 'Password reset successfully. Please log in with your new password.' },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/change-password
   * Requires: authenticated user
   * Body: { current_password, new_password }
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = ChangePasswordSchema.parse(req.body);
      await authService.changePassword(req.user!.user_id, input);

      res.status(200).json({
        success: true,
        data: { message: 'Password changed successfully.' },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Returns the authenticated user's profile from the JWT payload.
   */
  async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  }
}

export const authController = new AuthController();
