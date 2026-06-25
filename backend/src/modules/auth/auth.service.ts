import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../../db/index';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import type { JwtPayload } from '../../middleware/auth.middleware';
import type { LoginInput, ChangePasswordInput, ResetPasswordInput } from './auth.types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const OTP_EXPIRY_MINUTES = 10;

/**
 * AuthService — handles all authentication business logic.
 * All methods are pure business logic; HTTP concerns stay in the controller.
 */
export class AuthService {
  /**
   * Verifies credentials and returns JWT tokens.
   * Enforces account lockout after MAX_FAILED_ATTEMPTS.
   *
   * @throws AppError ERR-AUTH-001 — invalid credentials (generic, no field disclosure)
   * @throws AppError ERR-AUTH-002 — account locked
   */
  async login(input: LoginInput): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { user_id: string; username: string; role: string; must_change_password: boolean };
  }> {
    const { username, password } = input;

    // Fetch user — search by username OR email (case-insensitive for email)
    const { rows } = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.password_hash,
              u.is_active, u.failed_login_attempts, u.locked_until,
              u.must_change_password, r.role_name, r.role_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.username = $1 OR u.email = LOWER($1)
       LIMIT 1`,
      [username],
    );

    const user = rows[0];

    // Intentionally generic error — never reveal whether username or password is wrong
    const invalidCredentialsError = new AppError(
      'ERR-AUTH-001',
      'Invalid credentials. Please check your username and password.',
      401,
    );

    if (!user || !user.is_active) {
      throw invalidCredentialsError;
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.locked_until).getTime() - Date.now()) / 60000,
      );
      throw new AppError(
        'ERR-AUTH-002',
        `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        423,
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      // Increment failed attempts and potentially lock account
      const newAttempts = (user.failed_login_attempts ?? 0) + 1;
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

      await pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             locked_until = $2
         WHERE user_id = $3`,
        [
          newAttempts,
          shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
            : null,
          user.user_id,
        ],
      );

      if (shouldLock) {
        logger.warn({ code: 'ERR-AUTH-002', message: 'Account locked', username });
        throw new AppError(
          'ERR-AUTH-002',
          `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
          423,
        );
      }

      throw invalidCredentialsError;
    }

    // Success — reset failed attempts and update last_login
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login = NOW() AT TIME ZONE 'Asia/Kolkata'
       WHERE user_id = $1`,
      [user.user_id],
    );

    // Log the access event
    await pool.query(
      `INSERT INTO audit.access_logs (user_id, action, resource_type)
       VALUES ($1, 'LOGIN', 'session')`,
      [user.user_id],
    );

    const payload: JwtPayload = {
      user_id: user.user_id,
      username: user.username,
      role: user.role_name,
      role_id: user.role_id,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign(
      { user_id: user.user_id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any },
    );

    // Store refresh token in DB for server-side invalidation on logout
    await pool.query(
      `INSERT INTO user_sessions (user_id, login_timestamp)
       VALUES ($1, NOW() AT TIME ZONE 'Asia/Kolkata')`,
      [user.user_id],
    );

    return {
      accessToken,
      refreshToken,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role_name,
        must_change_password: user.must_change_password,
      },
    };
  }

  /**
   * Generates a 6-digit OTP, hashes it, and stores it against the user's mobile.
   * OTP expires in OTP_EXPIRY_MINUTES minutes.
   * Returns the plaintext OTP (to be sent via SMS by the controller).
   *
   * @throws AppError ERR-AUTH-005 if mobile number not found
   */
  async generateOtp(mobileNumber: string): Promise<string> {
    const { rows } = await pool.query(
      `SELECT user_id FROM users WHERE mobile_number = $1 AND is_active = TRUE LIMIT 1`,
      [mobileNumber],
    );

    if (rows.length === 0) {
      // Don't reveal whether number exists — just say "if registered, you'll get an OTP"
      logger.info({ message: 'OTP requested for unregistered mobile', mobile: '[REDACTED]' });
      return ''; // Caller handles gracefully
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 6); // Lower rounds for OTP — it's short-lived
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `UPDATE users SET otp_hash = $1, otp_expires_at = $2 WHERE user_id = $3`,
      [otpHash, expiresAt.toISOString(), rows[0].user_id],
    );

    return otp; // Plaintext — sent via SMS, never stored
  }

  /**
   * Resets the user's password after OTP verification.
   *
   * @throws AppError ERR-AUTH-005 if OTP is invalid or expired
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const { mobile_number, otp, new_password } = input;

    const { rows } = await pool.query(
      `SELECT user_id, otp_hash, otp_expires_at
       FROM users WHERE mobile_number = $1 AND is_active = TRUE LIMIT 1`,
      [mobile_number],
    );

    const user = rows[0];
    if (!user || !user.otp_hash) {
      throw new AppError('ERR-AUTH-005', 'OTP is invalid or has expired.', 400);
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      throw new AppError('ERR-AUTH-005', 'OTP has expired. Please request a new one.', 400);
    }

    const otpValid = await bcrypt.compare(otp, user.otp_hash);
    if (!otpValid) {
      throw new AppError('ERR-AUTH-005', 'OTP is invalid or has expired.', 400);
    }

    const passwordHash = await bcrypt.hash(new_password, env.BCRYPT_ROUNDS);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           otp_hash = NULL,
           otp_expires_at = NULL,
           must_change_password = FALSE,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE user_id = $2`,
      [passwordHash, user.user_id],
    );

    logger.info({ message: 'Password reset via OTP', user_id: user.user_id });
  }

  /**
   * Changes password for an authenticated user (requires current password).
   *
   * @throws AppError ERR-AUTH-001 if current password is wrong
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const { current_password, new_password } = input;

    const { rows } = await pool.query(
      `SELECT password_hash FROM users WHERE user_id = $1`,
      [userId],
    );

    const user = rows[0];
    if (!user) throw new AppError('ERR-AUTH-001', 'User not found.', 404);

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      throw new AppError('ERR-AUTH-001', 'Current password is incorrect.', 400);
    }

    const newHash = await bcrypt.hash(new_password, env.BCRYPT_ROUNDS);
    await pool.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = FALSE
       WHERE user_id = $2`,
      [newHash, userId],
    );

    logger.info({ message: 'Password changed by user', user_id: userId });
  }

  /**
   * Invalidates the user session server-side.
   * Cookie deletion alone is insufficient — server must mark session inactive.
   */
  async logout(userId: string): Promise<void> {
    await pool.query(
      `UPDATE user_sessions
       SET is_active = FALSE, logout_timestamp = NOW() AT TIME ZONE 'Asia/Kolkata'
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    await pool.query(
      `INSERT INTO audit.access_logs (user_id, action, resource_type)
       VALUES ($1, 'LOGOUT', 'session')`,
      [userId],
    );
  }
}

export const authService = new AuthService();
