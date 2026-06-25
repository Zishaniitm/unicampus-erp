import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Auth Routes — all under /api/v1/auth/
 *
 * Public:
 *   POST /login              — Login with username + password
 *   POST /forgot-password    — Request OTP for password reset
 *   POST /reset-password     — Reset password with OTP
 *
 * Authenticated:
 *   POST /logout             — Invalidate session
 *   POST /change-password    — Change password (requires current password)
 *   GET  /me                 — Get current user info from token
 */
const router = Router();

// Public routes
router.post('/login', authController.login.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));

// Authenticated routes
router.post('/logout', requireAuth, authController.logout.bind(authController));
router.post('/change-password', requireAuth, authController.changePassword.bind(authController));
router.get('/me', requireAuth, authController.me.bind(authController));

export default router;
