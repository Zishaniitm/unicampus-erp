import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import {
  CATEGORY_ROUTING,
  type SubmitGrievanceInput,
  type UpdateGrievanceStatusInput,
  type GrievanceListQuery,
} from './grievance.types';

// SLA: assigned officer must respond within this many days (FR-GRIEV-004).
// Overdue open/in_review tickets escalate to the Principal automatically.
const SLA_DAYS = 5;

/**
 * GrievanceService — student grievance ticketing.
 *
 * Business Rules (from SRS 3.8):
 * - Students submit with category + description (max 1000 chars)
 * - Category routes ticket to a role: academic → HOD, financial → Account
 *   Officer, hostel → Warden(Staff), library → Librarian, administrative → Admin
 * - Ticket ID format: GRV-<year>-<5-digit counter>
 * - Status flow: open → in_review → resolved; overdue tickets → escalated
 * - Every status change is recorded in grievance_updates (ticket timeline)
 */
export class GrievanceService {

  /**
   * Student submits a grievance. Ticket number generated atomically
   * from grievance_ticket_seq so concurrent submissions never clash.
   *
   * @throws AppError ERR-STU-005 if caller has no student profile
   */
  async submitGrievance(input: SubmitGrievanceInput, userId: string) {
    const { rows: studentRows } = await pool.query(
      `SELECT student_id FROM students WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );
    if (studentRows.length === 0) {
      throw new AppError('ERR-STU-005', 'Student record not found. Only students can submit grievances.', 404);
    }
    const studentId = studentRows[0].student_id;
    const assignedRole = CATEGORY_ROUTING[input.category];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: seqRows } = await client.query(
        `SELECT nextval('grievance_ticket_seq') AS seq,
                EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Kolkata')::int AS year`,
      );
      const ticketNumber = `GRV-${seqRows[0].year}-${String(seqRows[0].seq).padStart(5, '0')}`;

      const { rows } = await client.query(
        `INSERT INTO grievances
           (ticket_number, student_id, category, subject, description,
            status, assigned_role, sla_due_at)
         VALUES ($1, $2, $3, $4, $5, 'open', $6, NOW() + ($7 || ' days')::interval)
         RETURNING grievance_id, ticket_number, status, sla_due_at, created_at`,
        [ticketNumber, studentId, input.category, input.subject, input.description,
         assignedRole, SLA_DAYS],
      );

      await client.query(
        `INSERT INTO grievance_updates (grievance_id, old_status, new_status, comment, updated_by)
         VALUES ($1, NULL, 'open', 'Grievance submitted', $2)`,
        [rows[0].grievance_id, userId],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'GRIEVANCE_SUBMITTED', 'grievance', $2, $3)`,
        [userId, String(rows[0].grievance_id),
         JSON.stringify({ ticket_number: ticketNumber, category: input.category })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Grievance submitted', ticket: ticketNumber, category: input.category });
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Student's own grievances, newest first, with full status timeline per ticket. */
  async listMyGrievances(userId: string, query: GrievanceListQuery) {
    const { rows: studentRows } = await pool.query(
      `SELECT student_id FROM students WHERE user_id = $1`,
      [userId],
    );
    // Non-student roles have no tickets — return empty gracefully (matches attendance pattern)
    if (studentRows.length === 0) {
      return { grievances: [], meta: { page: 1, per_page: query.per_page, total: 0, total_pages: 0 } };
    }
    const studentId = studentRows[0].student_id;
    const offset = (query.page - 1) * query.per_page;

    const { rows } = await pool.query(
      `SELECT g.grievance_id, g.ticket_number, g.category, g.subject, g.description,
              g.status, g.assigned_role, g.sla_due_at, g.resolution_notes,
              g.resolved_at, g.created_at,
              (g.status IN ('open','in_review') AND g.sla_due_at < NOW()) AS sla_breached
       FROM grievances g
       WHERE g.student_id = $1
         AND ($2::text IS NULL OR g.status = $2)
       ORDER BY g.created_at DESC
       LIMIT $3 OFFSET $4`,
      [studentId, query.status ?? null, query.per_page, offset],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM grievances WHERE student_id = $1
         AND ($2::text IS NULL OR status = $2)`,
      [studentId, query.status ?? null],
    );

    const total = parseInt(countRows[0].count, 10);
    return {
      grievances: rows,
      meta: {
        page: query.page, per_page: query.per_page, total,
        total_pages: Math.ceil(total / query.per_page),
      },
    };
  }

  /**
   * Officer/admin queue. HOD, Account Officer, Librarian, Staff see only
   * tickets routed to their role; Principal and Super Admin see everything.
   */
  async listAssignedGrievances(role: string, query: GrievanceListQuery) {
    const seesAll = role === 'PRINCIPAL' || role === 'SUPER_ADMIN';
    const offset  = (query.page - 1) * query.per_page;

    const { rows } = await pool.query(
      `SELECT g.grievance_id, g.ticket_number, g.category, g.subject, g.description,
              g.status, g.assigned_role, g.sla_due_at, g.resolution_notes,
              g.resolved_at, g.created_at,
              s.roll_number,
              CONCAT(u.first_name, ' ', u.last_name) AS student_name,
              (g.status IN ('open','in_review') AND g.sla_due_at < NOW()) AS sla_breached
       FROM grievances g
       JOIN students s ON g.student_id = s.student_id
       JOIN users u    ON s.user_id = u.user_id
       WHERE ($1::boolean OR g.assigned_role = $2)
         AND ($3::text IS NULL OR g.status = $3)
         AND ($4::text IS NULL OR g.category = $4)
       ORDER BY
         (g.status IN ('open','in_review') AND g.sla_due_at < NOW()) DESC,  -- SLA-breached first
         CASE g.status WHEN 'escalated' THEN 0 WHEN 'open' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END,
         g.created_at ASC
       LIMIT $5 OFFSET $6`,
      [seesAll, role, query.status ?? null, query.category ?? null, query.per_page, offset],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM grievances g
       WHERE ($1::boolean OR g.assigned_role = $2)
         AND ($3::text IS NULL OR g.status = $3)
         AND ($4::text IS NULL OR g.category = $4)`,
      [seesAll, role, query.status ?? null, query.category ?? null],
    );

    const total = parseInt(countRows[0].count, 10);
    return {
      grievances: rows,
      meta: {
        page: query.page, per_page: query.per_page, total,
        total_pages: Math.ceil(total / query.per_page),
      },
    };
  }

  /**
   * Full ticket detail + timeline. Students may only view their own tickets;
   * officers only tickets routed to their role (Principal/Admin see all).
   *
   * @throws AppError ERR-GRIEV-001 if not found
   * @throws AppError ERR-AUTH-004 if caller may not view this ticket
   */
  async getGrievance(grievanceId: number, userId: string, role: string) {
    const { rows } = await pool.query(
      `SELECT g.*, s.roll_number, s.user_id AS student_user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS student_name,
              (g.status IN ('open','in_review') AND g.sla_due_at < NOW()) AS sla_breached
       FROM grievances g
       JOIN students s ON g.student_id = s.student_id
       JOIN users u    ON s.user_id = u.user_id
       WHERE g.grievance_id = $1`,
      [grievanceId],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-GRIEV-001', 'Grievance ticket not found.', 404);
    }
    const grievance = rows[0];

    const isOwner   = grievance.student_user_id === userId;
    const seesAll   = role === 'PRINCIPAL' || role === 'SUPER_ADMIN';
    const isOfficer = grievance.assigned_role === role;
    if (!isOwner && !seesAll && !isOfficer) {
      throw new AppError('ERR-AUTH-004', 'You do not have permission to view this grievance.', 403);
    }

    const { rows: timeline } = await pool.query(
      `SELECT gu.old_status, gu.new_status, gu.comment, gu.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS updated_by_name
       FROM grievance_updates gu
       JOIN users u ON gu.updated_by = u.user_id
       WHERE gu.grievance_id = $1
       ORDER BY gu.created_at ASC`,
      [grievanceId],
    );

    // Hide internal student_user_id from the response
    const { student_user_id, ...ticket } = grievance;
    return { ...ticket, timeline };
  }

  /**
   * Officer updates ticket status. Resolving requires resolution notes
   * (FR-GRIEV-005). Every change is appended to the timeline.
   *
   * @throws AppError ERR-GRIEV-001 if not found
   * @throws AppError ERR-AUTH-004 if ticket not routed to caller's role
   * @throws AppError ERR-GRIEV-003 if ticket already resolved
   */
  async updateStatus(
    grievanceId: number,
    input: UpdateGrievanceStatusInput,
    userId: string,
    role: string,
  ) {
    const { rows } = await pool.query(
      `SELECT grievance_id, status, assigned_role, ticket_number FROM grievances WHERE grievance_id = $1`,
      [grievanceId],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-GRIEV-001', 'Grievance ticket not found.', 404);
    }
    const grievance = rows[0];

    const seesAll = role === 'PRINCIPAL' || role === 'SUPER_ADMIN';
    if (!seesAll && grievance.assigned_role !== role) {
      throw new AppError('ERR-AUTH-004', 'This grievance is not assigned to your role.', 403);
    }
    if (grievance.status === 'resolved') {
      throw new AppError('ERR-GRIEV-003', 'This grievance is already resolved.', 422);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE grievances
         SET status = $1::text,
             assigned_to = COALESCE(assigned_to, $2),
             resolution_notes = CASE WHEN $1::text = 'resolved' THEN $3 ELSE resolution_notes END,
             resolved_by      = CASE WHEN $1::text = 'resolved' THEN $2 ELSE resolved_by END,
             resolved_at      = CASE WHEN $1::text = 'resolved' THEN NOW() ELSE resolved_at END,
             escalated_at     = CASE WHEN $1::text = 'escalated' THEN NOW() ELSE escalated_at END,
             updated_at = NOW()
         WHERE grievance_id = $4`,
        [input.status, userId, input.resolution_notes ?? null, grievanceId],
      );

      await client.query(
        `INSERT INTO grievance_updates (grievance_id, old_status, new_status, comment, updated_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [grievanceId, grievance.status, input.status,
         input.comment ?? input.resolution_notes ?? null, userId],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'GRIEVANCE_STATUS_CHANGED', 'grievance', $2, $3)`,
        [userId, String(grievanceId),
         JSON.stringify({ ticket: grievance.ticket_number, from: grievance.status, to: input.status })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Grievance status updated', ticket: grievance.ticket_number, from: grievance.status, to: input.status });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { grievance_id: grievanceId, status: input.status };
  }

  /**
   * Escalates all SLA-breached open/in_review tickets to the Principal
   * (FR-GRIEV-004). Called by admin endpoint now; wired to a BullMQ
   * scheduled job when the jobs module lands.
   */
  async escalateOverdue(triggeredBy: string) {
    const { rows } = await pool.query(
      `UPDATE grievances
       SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
       WHERE status IN ('open', 'in_review') AND sla_due_at < NOW()
       RETURNING grievance_id, ticket_number, status`,
    );

    for (const g of rows) {
      await pool.query(
        `INSERT INTO grievance_updates (grievance_id, old_status, new_status, comment, updated_by)
         VALUES ($1, NULL, 'escalated', 'Auto-escalated: SLA breached', $2)`,
        [g.grievance_id, triggeredBy],
      );
    }

    if (rows.length > 0) {
      logger.warn({ message: 'Grievances auto-escalated (SLA breach)', count: rows.length });
    }
    return { escalated: rows.length, tickets: rows.map(r => r.ticket_number) };
  }
}

export const grievanceService = new GrievanceService();
