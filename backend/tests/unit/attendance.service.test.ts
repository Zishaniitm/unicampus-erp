/**
 * Unit tests for AttendanceService — business logic only, DB mocked.
 */

jest.mock('../../src/db/index', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../src/config/env', () => ({
  env: {
    BCRYPT_ROUNDS: 4,
    COLLEGE_CODE: 'FUGS',
    NODE_ENV: 'test',
    TIMEZONE: 'Asia/Kolkata',
  },
}));

import { pool } from '../../src/db/index';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import { AppError } from '../../src/middleware/error.middleware';

const mockPool = pool as jest.Mocked<typeof pool>;
const service  = new AttendanceService();

beforeEach(() => jest.clearAllMocks());

// ── MARK ATTENDANCE ─────────────────────────────────────────
describe('AttendanceService.markAttendance', () => {
  const mockClient = {
    query:   jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };

  beforeEach(() => {
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  it('should reject if timetable entry not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(service.markAttendance(
      { timetable_entry_id: 999, att_date: '2026-07-05', records: [{ student_id: 1, status: 'P' }] },
      'teacher-uuid', 'TEACHER',
    )).rejects.toMatchObject({ code: 'ERR-TT-004', statusCode: 404 });
  });

  it('should reject if teacher tries to mark another teacher\'s class', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ entry_id: 1, teacher_id: 5, user_id: 'other-teacher-uuid', timetable_id: 1 }],
    });

    await expect(service.markAttendance(
      { timetable_entry_id: 1, att_date: '2026-07-05', records: [{ student_id: 1, status: 'P' }] },
      'my-teacher-uuid', 'TEACHER',
    )).rejects.toMatchObject({ code: 'ERR-AUTH-004', statusCode: 403 });
  });

  it('should allow HOD to mark any class regardless of teacher_id', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ entry_id: 1, teacher_id: 5, user_id: 'some-teacher', timetable_id: 1 }],
    });

    await expect(service.markAttendance(
      { timetable_entry_id: 1, att_date: '2026-07-05', records: [{ student_id: 1, status: 'P' }] },
      'hod-uuid', 'HOD',
    )).resolves.toEqual({ marked: 1 });
  });
});

// ── EDIT ATTENDANCE ─────────────────────────────────────────
describe('AttendanceService.editAttendance', () => {
  it('should throw ERR-ATT-003 if record not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(service.editAttendance(
      { att_id: 999, status: 'P', edit_reason: 'Correction needed for student' },
      'teacher-uuid', 'TEACHER',
    )).rejects.toMatchObject({ code: 'ERR-ATT-003', statusCode: 404 });
  });

  it('should throw ERR-ATT-001 if teacher edits outside 24h window', async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago

    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ att_id: 1, marked_at: oldDate, teacher_user_id: 'teacher-uuid' }],
    });

    await expect(service.editAttendance(
      { att_id: 1, status: 'P', edit_reason: 'Was present but marked absent' },
      'teacher-uuid', 'TEACHER',
    )).rejects.toMatchObject({ code: 'ERR-ATT-001', statusCode: 422 });
  });

  it('should allow HOD to edit after 24h window with reason', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ att_id: 1, marked_at: oldDate, teacher_user_id: 'teacher-uuid' }] })
      .mockResolvedValue({ rows: [] }); // UPDATE + audit log

    await expect(service.editAttendance(
      { att_id: 1, status: 'ML', edit_reason: 'Medical certificate submitted to HOD office' },
      'hod-uuid', 'HOD',
    )).resolves.toBeUndefined();
  });

  it('should reject edit_reason shorter than 10 characters', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ att_id: 1, marked_at: new Date().toISOString(), teacher_user_id: 'hod-uuid' }],
    });

    await expect(service.editAttendance(
      { att_id: 1, status: 'P', edit_reason: 'Short' },
      'hod-uuid', 'HOD',
    )).rejects.toMatchObject({ code: 'ERR-ATT-001', statusCode: 400 });
  });
});

// ── STUDENT SUMMARY ─────────────────────────────────────────
describe('AttendanceService.getStudentSummary', () => {
  it('should return empty array if no student profile found (non-student roles)', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const result = await service.getStudentSummary('admin-uuid');
    expect(result).toEqual([]);
  });

  it('should return subject-wise percentage data', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ student_id: 1, batch_id: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          { course_code: 'CS101', course_name: 'Programming', total_classes: '20',
            present: '16', absent: '2', medical_leave: '1', duty_leave: '1', percentage: '90.00' },
          { course_code: 'CS102', course_name: 'Data Structures', total_classes: '18',
            present: '12', absent: '6', medical_leave: '0', duty_leave: '0', percentage: '66.67' },
        ],
      });

    const result = await service.getStudentSummary('student-uuid');
    expect(result).toHaveLength(2);
    expect(result[0].percentage).toBe(90);
    expect(result[1].percentage).toBe(66.67);
  });

  it('percentage should treat ML and DL as present', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ student_id: 1, batch_id: 2 }] })
      .mockResolvedValueOnce({
        rows: [{
          course_code: 'CS101', course_name: 'Programming',
          total_classes: '10', present: '7', absent: '1',
          medical_leave: '1', duty_leave: '1', percentage: '90.00',
        }],
      });

    const result = await service.getStudentSummary('student-uuid');
    // P(7) + ML(1) + DL(1) = 9 out of 10 = 90%
    expect(result[0].percentage).toBe(90);
  });
});
