/**
 * Unit tests for AdmissionService — credential generation and bulk import logic.
 * All DB calls are mocked.
 */

jest.mock('../../src/db/index', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../src/config/env', () => ({
  env: {
    BCRYPT_ROUNDS: 4,
    COLLEGE_CODE: 'FUGS',
    NODE_ENV: 'test',
    ENABLE_SMS: false,
    ENABLE_EMAIL: false,
    TIMEZONE: 'Asia/Kolkata',
  },
}));

import { pool } from '../../src/db/index';
import { AdmissionService } from '../../src/modules/admission/admission.service';
import { AppError } from '../../src/middleware/error.middleware';

const mockPool = pool as jest.Mocked<typeof pool>;
const admissionService = new AdmissionService();

beforeEach(() => jest.clearAllMocks());

// ── CREDENTIAL GENERATION ───────────────────────────────────
describe('AdmissionService.generateCredentials', () => {
  it('should generate username in format rollnumber@COLLEGE_CODE', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{
          student_id: 1,
          roll_number: 'BCA240001',
          admission_status: 'confirmed',
          credential_sent_at: null,
          user_id: 'uuid-1',
          first_name: 'Rahul',
          email: 'rahul@test.com',
          mobile_number: '9876543210',
        }],
      })
      .mockResolvedValue({ rows: [] }); // UPDATE users, UPDATE students, INSERT audit

    const results = await admissionService.generateCredentials({ student_ids: [1] }, 'admin-uuid');
    expect(results[0].username).toBe('bca240001@fugs');
  });

  it('should throw ERR-ADM-002 if any student is not confirmed', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ student_id: 1, roll_number: 'BCA240001', admission_status: 'pending', user_id: 'uuid-1' }],
    });

    await expect(
      admissionService.generateCredentials({ student_ids: [1] }, 'admin-uuid'),
    ).rejects.toMatchObject({ code: 'ERR-ADM-002', statusCode: 422 });
  });

  it('should never store plaintext password — result contains it but DB calls do not', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{
          student_id: 1,
          roll_number: 'BCA240001',
          admission_status: 'confirmed',
          credential_sent_at: null,
          user_id: 'uuid-1',
          first_name: 'Rahul',
          email: 'rahul@test.com',
          mobile_number: '9876543210',
        }],
      })
      .mockResolvedValue({ rows: [] });

    const results = await admissionService.generateCredentials({ student_ids: [1] }, 'admin');

    // Result has plaintext for SMS dispatch
    expect(results[0].plaintext_password).toBeDefined();
    expect(results[0].plaintext_password.length).toBe(10);

    // But DB UPDATE should have stored a bcrypt hash, not the plaintext
    const updateCall = (mockPool.query as jest.Mock).mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE users'),
    );
    expect(updateCall).toBeDefined();
    const storedHash = updateCall[1][1]; // second param = password_hash
    expect(storedHash).toMatch(/^\$2[ab]\$/); // bcrypt hash prefix
    expect(storedHash).not.toBe(results[0].plaintext_password);
  });

  it('should throw ERR-STU-005 if no students found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(
      admissionService.generateCredentials({ student_ids: [999] }, 'admin'),
    ).rejects.toMatchObject({ code: 'ERR-STU-005', statusCode: 404 });
  });

  it('generated passwords should always be exactly 10 characters', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValue({
        rows: [{
          student_id: 1,
          roll_number: 'BCA240001',
          admission_status: 'confirmed',
          user_id: 'uuid-1',
          first_name: 'Rahul',
          email: 'r@test.com',
          mobile_number: '9876543210',
        }],
      });

    // Generate 10 times to verify consistency
    const lengths = new Set<number>();
    for (let i = 0; i < 10; i++) {
      jest.clearAllMocks();
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{
          student_id: 1, roll_number: 'BCA240001', admission_status: 'confirmed',
          user_id: 'uuid-1', first_name: 'Rahul', email: 'r@test.com', mobile_number: '9876543210',
        }],
      });
      const r = await admissionService.generateCredentials({ student_ids: [1] }, 'admin');
      lengths.add(r[0].plaintext_password.length);
    }
    expect(lengths.size).toBe(1);
    expect([...lengths][0]).toBe(10);
  });
});

// ── ONBOARDING STATUS ───────────────────────────────────────
describe('AdmissionService.getOnboardingStatus', () => {
  it('should return correct counts for all onboarding stages', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ not_generated: '5', sent_not_logged: '12', logged_in: '3', fully_onboarded: '80', total: '100' }],
    });

    const counts = await admissionService.getOnboardingStatus({});
    expect(counts.not_generated).toBe(5);
    expect(counts.sent_not_logged).toBe(12);
    expect(counts.logged_in).toBe(3);
    expect(counts.fully_onboarded).toBe(80);
    expect(counts.total).toBe(100);
  });
});

// ── IMPORT TEMPLATE ─────────────────────────────────────────
describe('AdmissionService.getBulkImportTemplate', () => {
  it('should return a non-empty buffer (valid Excel file)', async () => {
    const buffer = await admissionService.getBulkImportTemplate();
    expect(buffer).toBeDefined();
    // Excel files are always > 4KB due to the OOXML format overhead
    expect((buffer as any).length ?? (buffer as any).byteLength).toBeGreaterThan(4000);
  });
});
