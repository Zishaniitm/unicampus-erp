/**
 * Unit tests for TimetableService — conflict detection logic.
 */

jest.mock('../../src/db/index', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../src/config/env', () => ({
  env: { NODE_ENV: 'test', COLLEGE_CODE: 'FUGS', TIMEZONE: 'Asia/Kolkata' },
}));

import { pool } from '../../src/db/index';
import { TimetableService } from '../../src/modules/timetable/timetable.service';
import { AppError } from '../../src/middleware/error.middleware';

const mockPool = pool as jest.Mocked<typeof pool>;
const service  = new TimetableService();

beforeEach(() => jest.clearAllMocks());

describe('TimetableService.createEntry', () => {
  const validInput = {
    timetable_id: 1, day_of_week: 'Monday',
    time_slot_id: 1, batch_course_id: 1,
    classroom_id: 1, teacher_id: 1,
  };

  it('should throw ERR-TT-004 if timetable not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(service.createEntry(validInput, 'hod-uuid'))
      .rejects.toMatchObject({ code: 'ERR-TT-004', statusCode: 404 });
  });

  it('should throw ERR-TT-001 on teacher clash', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ timetable_id: 1, batch_id: 2 }] }) // timetable exists
      .mockResolvedValueOnce({ rows: [{ entry_id: 99 }] });                  // teacher clash found

    await expect(service.createEntry(validInput, 'hod-uuid'))
      .rejects.toMatchObject({ code: 'ERR-TT-001', statusCode: 409 });
  });

  it('should throw ERR-TT-002 on classroom clash', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ timetable_id: 1, batch_id: 2 }] }) // timetable exists
      .mockResolvedValueOnce({ rows: [] })                                    // no teacher clash
      .mockResolvedValueOnce({ rows: [{ entry_id: 88 }] });                  // classroom clash

    await expect(service.createEntry(validInput, 'hod-uuid'))
      .rejects.toMatchObject({ code: 'ERR-TT-002', statusCode: 409 });
  });

  it('should throw ERR-TT-003 on batch clash', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ timetable_id: 1, batch_id: 2 }] }) // timetable
      .mockResolvedValueOnce({ rows: [] })                                    // no teacher clash
      .mockResolvedValueOnce({ rows: [] })                                    // no room clash
      .mockResolvedValueOnce({ rows: [{ entry_id: 77 }] });                  // batch clash

    await expect(service.createEntry(validInput, 'hod-uuid'))
      .rejects.toMatchObject({ code: 'ERR-TT-003', statusCode: 409 });
  });

  it('should create entry when no conflicts exist', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ timetable_id: 1, batch_id: 2 }] }) // timetable
      .mockResolvedValueOnce({ rows: [] })  // no teacher clash
      .mockResolvedValueOnce({ rows: [] })  // no room clash
      .mockResolvedValueOnce({ rows: [] })  // no batch clash
      .mockResolvedValueOnce({ rows: [{ entry_id: 42 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // audit log

    const result = await service.createEntry(validInput, 'hod-uuid');
    expect(result).toEqual({ entry_id: 42 });
  });
});

describe('TimetableService.cancelEntry', () => {
  it('should throw ERR-TT-004 if entry not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(service.cancelEntry(999, 'Test reason', 'hod-uuid'))
      .rejects.toMatchObject({ code: 'ERR-TT-004', statusCode: 404 });
  });

  it('should cancel entry and write audit log', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ entry_id: 1, timetable_id: 1 }] }) // entry found
      .mockResolvedValueOnce({ rows: [] })  // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // audit log

    await expect(service.cancelEntry(1, 'Faculty on duty leave', 'hod-uuid'))
      .resolves.toBeUndefined();

    // Verify UPDATE was called
    const updateCall = (mockPool.query as jest.Mock).mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE timetable_entries/);
    expect(updateCall[0]).toMatch(/is_cancelled = TRUE/);
  });
});
