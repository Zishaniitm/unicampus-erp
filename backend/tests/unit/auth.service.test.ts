/**
 * Unit tests for AuthService business logic.
 * These tests mock the DB pool — no real database needed.
 * Run: npm run test:unit
 */

// Mock the DB pool before importing anything that uses it
jest.mock('../../src/db/index', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock env so tests don't need a real .env file
jest.mock('../../src/config/env', () => ({
  env: {
    BCRYPT_ROUNDS: 10, // Lower rounds in tests for speed
    JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars-long',
    JWT_ACCESS_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
    ENABLE_SMS: false,
    ENABLE_EMAIL: false,
    TIMEZONE: 'Asia/Kolkata',
    COLLEGE_CODE: 'FUGS',
  },
}));

import bcrypt from 'bcrypt';
import { pool } from '../../src/db/index';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AppError } from '../../src/middleware/error.middleware';

const mockPool = pool as jest.Mocked<typeof pool>;
const authService = new AuthService();

beforeEach(() => {
  jest.clearAllMocks();
});

// ── LOGIN TESTS ───────────────────────────────────────────────
describe('AuthService.login', () => {
  it('should return tokens on valid credentials', async () => {
    const hash = await bcrypt.hash('Password@123', 10);

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'uuid-1',
          username: 'student1',
          email: 'student1@test.com',
          password_hash: hash,
          is_active: true,
          failed_login_attempts: 0,
          locked_until: null,
          must_change_password: false,
          role_name: 'STUDENT',
          role_id: 9,
        }],
      })
      .mockResolvedValue({ rows: [] }); // subsequent queries (update, audit log, session)

    const result = await authService.login({ username: 'student1', password: 'Password@123' });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.role).toBe('STUDENT');
    expect(result.user.must_change_password).toBe(false);
  });

  it('should throw ERR-AUTH-001 for wrong password', async () => {
    const hash = await bcrypt.hash('CorrectPassword@1', 10);

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'uuid-1',
          username: 'student1',
          email: 'student1@test.com',
          password_hash: hash,
          is_active: true,
          failed_login_attempts: 0,
          locked_until: null,
          must_change_password: false,
          role_name: 'STUDENT',
          role_id: 9,
        }],
      })
      .mockResolvedValue({ rows: [] });

    await expect(
      authService.login({ username: 'student1', password: 'WrongPassword@1' }),
    ).rejects.toMatchObject({ code: 'ERR-AUTH-001', statusCode: 401 });
  });

  it('should throw ERR-AUTH-001 for non-existent user', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(
      authService.login({ username: 'ghost', password: 'any' }),
    ).rejects.toMatchObject({ code: 'ERR-AUTH-001', statusCode: 401 });
  });

  it('should throw ERR-AUTH-001 for inactive user', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ user_id: 'uuid-1', is_active: false }],
    });

    await expect(
      authService.login({ username: 'student1', password: 'any' }),
    ).rejects.toMatchObject({ code: 'ERR-AUTH-001' });
  });

  it('should throw ERR-AUTH-002 for locked account', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        user_id: 'uuid-1',
        username: 'student1',
        password_hash: 'irrelevant',
        is_active: true,
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // locked for 10 more min
        must_change_password: false,
        role_name: 'STUDENT',
        role_id: 9,
      }],
    });

    await expect(
      authService.login({ username: 'student1', password: 'any' }),
    ).rejects.toMatchObject({ code: 'ERR-AUTH-002', statusCode: 423 });
  });

  it('error message should never reveal which field is wrong', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    try {
      await authService.login({ username: 'nobody', password: 'any' });
    } catch (err) {
      expect((err as AppError).message).not.toMatch(/username/i);
      expect((err as AppError).message).not.toMatch(/password/i);
      expect((err as AppError).message).toMatch(/invalid credentials/i);
    }
  });
});

// ── CHANGE PASSWORD TESTS ──────────────────────────────────────
describe('AuthService.changePassword', () => {
  it('should update password hash when current password is correct', async () => {
    const hash = await bcrypt.hash('OldPassword@1', 10);

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ password_hash: hash }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      authService.changePassword('uuid-1', {
        current_password: 'OldPassword@1',
        new_password: 'NewPassword@2',
      }),
    ).resolves.toBeUndefined();

    // Verify UPDATE was called
    const updateCall = (mockPool.query as jest.Mock).mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE users/);
    expect(updateCall[0]).toMatch(/must_change_password = FALSE/);
  });

  it('should throw ERR-AUTH-001 when current password is wrong', async () => {
    const hash = await bcrypt.hash('CorrectOld@1', 10);

    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ password_hash: hash }],
    });

    await expect(
      authService.changePassword('uuid-1', {
        current_password: 'WrongOld@1',
        new_password: 'NewPassword@2',
      }),
    ).rejects.toMatchObject({ code: 'ERR-AUTH-001', statusCode: 400 });
  });
});

// ── LOGOUT TESTS ───────────────────────────────────────────────
describe('AuthService.logout', () => {
  it('should invalidate session and create audit log', async () => {
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await authService.logout('uuid-1');

    expect(mockPool.query).toHaveBeenCalledTimes(2);

    const sessionQuery = (mockPool.query as jest.Mock).mock.calls[0][0] as string;
    expect(sessionQuery).toMatch(/UPDATE user_sessions/);
    expect(sessionQuery).toMatch(/is_active = FALSE/);

    const auditQuery = (mockPool.query as jest.Mock).mock.calls[1][0] as string;
    expect(auditQuery).toMatch(/audit\.access_logs/);
    expect(auditQuery).toMatch(/LOGOUT/);
  });
});
