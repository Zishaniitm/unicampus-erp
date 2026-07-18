/**
 * Unit tests for GrievanceService — business logic only, DB mocked.
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
import { GrievanceService } from '../../src/modules/grievance/grievance.service';
import { CATEGORY_ROUTING } from '../../src/modules/grievance/grievance.types';
import { AppError } from '../../src/middleware/error.middleware';

const mockPool = pool as jest.Mocked<typeof pool>;
const service  = new GrievanceService();

const mockClient = {
  query:   jest.fn(),
  release: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
  mockClient.query.mockResolvedValue({ rows: [] });
});

// ── CATEGORY ROUTING ────────────────────────────────────────
describe('Category routing (FR-GRIEV-002)', () => {
  it('routes each category to the correct role', () => {
    expect(CATEGORY_ROUTING.academic).toBe('HOD');
    expect(CATEGORY_ROUTING.financial).toBe('ACCOUNT_OFFICER');
    expect(CATEGORY_ROUTING.hostel).toBe('STAFF');
    expect(CATEGORY_ROUTING.library).toBe('LIBRARIAN');
    expect(CATEGORY_ROUTING.administrative).toBe('SUPER_ADMIN');
    expect(CATEGORY_ROUTING.other).toBe('SUPER_ADMIN');
  });
});

// ── SUBMIT ──────────────────────────────────────────────────
describe('GrievanceService.submitGrievance', () => {
  const input = {
    category: 'academic' as const,
    subject: 'Marks not updated',
    description: 'My CA1 marks for DBMS have not been updated in the portal for two weeks.',
  };

  it('should reject if caller has no student profile', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(service.submitGrievance(input, 'user-uuid'))
      .rejects.toMatchObject({ code: 'ERR-STU-005' });
  });

  it('should create a ticket with GRV-<year>-<seq> number and route to HOD', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ student_id: 7 }] });

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ seq: '42', year: 2026 }] })     // nextval + year
      .mockResolvedValueOnce({ rows: [{                                 // INSERT grievance
        grievance_id: 1, ticket_number: 'GRV-2026-00042', status: 'open',
        sla_due_at: '2026-07-23', created_at: '2026-07-18',
      }] })
      .mockResolvedValueOnce({ rows: [] })                              // timeline insert
      .mockResolvedValueOnce({ rows: [] })                              // audit log
      .mockResolvedValueOnce({ rows: [] });                             // COMMIT

    const result = await service.submitGrievance(input, 'user-uuid');

    expect(result.ticket_number).toBe('GRV-2026-00042');
    expect(result.status).toBe('open');

    // INSERT was called with assigned_role = HOD (academic routing)
    const insertCall = mockClient.query.mock.calls.find(c => String(c[0]).includes('INSERT INTO grievances'));
    expect(insertCall![1]).toContain('HOD');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('should roll back if the insert fails', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ student_id: 7 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ seq: '1', year: 2026 }] })
      .mockRejectedValueOnce(new Error('db down'));

    await expect(service.submitGrievance(input, 'user-uuid')).rejects.toThrow('db down');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ── GET ONE (permissions) ───────────────────────────────────
describe('GrievanceService.getGrievance', () => {
  const ticketRow = {
    grievance_id: 5, ticket_number: 'GRV-2026-00005', category: 'library',
    status: 'open', assigned_role: 'LIBRARIAN',
    student_user_id: 'student-uuid', roll_number: 'BCA2024001',
    student_name: 'Aman Verma', sla_breached: false,
  };

  it('should throw ERR-GRIEV-001 when ticket not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(service.getGrievance(999, 'user', 'STUDENT'))
      .rejects.toMatchObject({ code: 'ERR-GRIEV-001' });
  });

  it('should allow the owning student to view', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ticketRow] })
      .mockResolvedValueOnce({ rows: [] });   // timeline

    const result = await service.getGrievance(5, 'student-uuid', 'STUDENT');
    expect(result.ticket_number).toBe('GRV-2026-00005');
    expect(result).not.toHaveProperty('student_user_id'); // internal field stripped
  });

  it('should allow the routed officer role to view', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ticketRow] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.getGrievance(5, 'librarian-uuid', 'LIBRARIAN')).resolves.toBeDefined();
  });

  it('should deny an unrelated student', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [ticketRow] });

    await expect(service.getGrievance(5, 'other-student-uuid', 'STUDENT'))
      .rejects.toMatchObject({ code: 'ERR-AUTH-004' });
  });

  it('should deny an officer of a different role', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [ticketRow] });

    await expect(service.getGrievance(5, 'hod-uuid', 'HOD'))
      .rejects.toMatchObject({ code: 'ERR-AUTH-004' });
  });

  it('should allow PRINCIPAL to view any ticket', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ticketRow] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.getGrievance(5, 'principal-uuid', 'PRINCIPAL')).resolves.toBeDefined();
  });
});

// ── UPDATE STATUS ───────────────────────────────────────────
describe('GrievanceService.updateStatus', () => {
  const openTicket = { grievance_id: 5, status: 'open', assigned_role: 'HOD', ticket_number: 'GRV-2026-00005' };

  it('should throw ERR-GRIEV-001 when ticket not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(service.updateStatus(999, { status: 'in_review' }, 'u', 'HOD'))
      .rejects.toMatchObject({ code: 'ERR-GRIEV-001' });
  });

  it('should deny an officer whose role does not match the routing', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [openTicket] });

    await expect(service.updateStatus(5, { status: 'in_review' }, 'u', 'LIBRARIAN'))
      .rejects.toMatchObject({ code: 'ERR-AUTH-004' });
  });

  it('should reject changes to an already-resolved ticket', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ ...openTicket, status: 'resolved' }] });

    await expect(service.updateStatus(5, { status: 'in_review' }, 'u', 'HOD'))
      .rejects.toMatchObject({ code: 'ERR-GRIEV-003' });
  });

  it('should update status inside a transaction and write the timeline', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [openTicket] });
    mockClient.query.mockResolvedValue({ rows: [] });

    const result = await service.updateStatus(
      5,
      { status: 'resolved', resolution_notes: 'Marks corrected in the portal after verification.' },
      'hod-uuid', 'HOD',
    );

    expect(result).toEqual({ grievance_id: 5, status: 'resolved' });
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    const timelineCall = mockClient.query.mock.calls.find(c => String(c[0]).includes('grievance_updates'));
    expect(timelineCall![1]).toEqual(
      expect.arrayContaining([5, 'open', 'resolved']),
    );
  });

  it('should allow SUPER_ADMIN to update any ticket', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [openTicket] });
    mockClient.query.mockResolvedValue({ rows: [] });

    await expect(service.updateStatus(5, { status: 'in_review' }, 'admin-uuid', 'SUPER_ADMIN'))
      .resolves.toEqual({ grievance_id: 5, status: 'in_review' });
  });
});

// ── ESCALATION SWEEP ────────────────────────────────────────
describe('GrievanceService.escalateOverdue', () => {
  it('should escalate overdue tickets and report count', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [
        { grievance_id: 1, ticket_number: 'GRV-2026-00001', status: 'escalated' },
        { grievance_id: 2, ticket_number: 'GRV-2026-00002', status: 'escalated' },
      ] })
      .mockResolvedValue({ rows: [] });   // timeline inserts

    const result = await service.escalateOverdue('admin-uuid');
    expect(result.escalated).toBe(2);
    expect(result.tickets).toEqual(['GRV-2026-00001', 'GRV-2026-00002']);
  });

  it('should report zero when nothing is overdue', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const result = await service.escalateOverdue('admin-uuid');
    expect(result.escalated).toBe(0);
  });
});
