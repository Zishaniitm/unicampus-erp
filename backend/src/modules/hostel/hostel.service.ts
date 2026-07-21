import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { isRegistrationWindowOpen, type RegistrationWindow } from '../../utils/registrationWindow';
import {
  currentAcademicYear,
  type CreateHostelCategoryInput, type ApplyHostelInput,
  type DecideRegistrationInput, type SetWindowInput,
} from './hostel.types';

/**
 * HostelService — categories, registration windows, student applications,
 * staff approval (SRS 3.6).
 *
 * Rules:
 * - Apply only inside an open 'hostel' window (ERR-HST-001), server-side IST.
 * - Category capacity counts pending + approved for the year (ERR-HST-002).
 * - One live registration per student per year (ERR-HST-003) — DB partial
 *   unique index backs the service check.
 * - Rejection requires a reason; every decision audited.
 */
export class HostelService {

  // ── Windows (shared table; hostel module owns the admin endpoints) ──

  /** Upserts a registration window for a type + academic year. */
  async setWindow(input: SetWindowInput, createdBy: string) {
    const { rows } = await pool.query(
      `INSERT INTO registration_windows (window_type, academic_year, opens_at, closes_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (window_type, academic_year)
       DO UPDATE SET opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at,
                     is_active = TRUE, updated_at = NOW()
       RETURNING window_id, window_type, academic_year, opens_at, closes_at`,
      [input.window_type, input.academic_year, input.opens_at, input.closes_at, createdBy],
    );

    await this.audit(createdBy, 'REG_WINDOW_SET', 'registration_window', String(rows[0].window_id), {
      type: input.window_type, year: input.academic_year,
    });
    return rows[0];
  }

  /** Fetches the window for a type in the current academic year (may be null). */
  async getWindow(windowType: string): Promise<RegistrationWindow | null> {
    const year = currentAcademicYear();
    const { rows } = await pool.query(
      `SELECT window_id, window_type, academic_year, opens_at, closes_at, is_active
         FROM registration_windows
        WHERE window_type = $1 AND academic_year = $2`,
      [windowType, year],
    );
    return rows[0] ?? null;
  }

  // ── Categories ─────────────────────────────────────────────

  /** Lists categories with live occupancy for the current year. */
  async listCategories() {
    const year = currentAcademicYear();
    const { rows } = await pool.query(
      `SELECT c.category_id, c.category_name, c.description, c.gender,
              c.total_capacity, c.fee_per_semester_paise, c.is_active,
              COUNT(r.registration_id) FILTER (WHERE r.status IN ('pending','approved'))::int AS occupied
         FROM hostel_categories c
         LEFT JOIN hostel_registrations r
                ON r.category_id = c.category_id AND r.academic_year = $1
        WHERE c.is_active = TRUE
        GROUP BY c.category_id
        ORDER BY c.category_name`,
      [year],
    );
    return rows.map(r => ({ ...r, available: Math.max(0, r.total_capacity - r.occupied) }));
  }

  /** Staff creates a hostel category. */
  async createCategory(input: CreateHostelCategoryInput, createdBy: string) {
    const dupe = await pool.query(
      `SELECT 1 FROM hostel_categories WHERE category_name = $1`, [input.category_name]);
    if (dupe.rows.length > 0) {
      throw new AppError('ERR-HST-002', 'A category with this name already exists.', 422);
    }

    const { rows } = await pool.query(
      `INSERT INTO hostel_categories
         (category_name, description, gender, total_capacity, fee_per_semester_paise, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING category_id, category_name, total_capacity, fee_per_semester_paise`,
      [input.category_name, input.description ?? null, input.gender ?? 'Any',
       input.total_capacity, input.fee_per_semester_paise, createdBy],
    );

    await this.audit(createdBy, 'HOSTEL_CATEGORY_CREATED', 'hostel_category',
      String(rows[0].category_id), { name: input.category_name });
    return rows[0];
  }

  // ── Student application ────────────────────────────────────

  /**
   * Student applies for a hostel place.
   * @throws ERR-HST-001 window closed · ERR-HST-002 category full
   * @throws ERR-HST-003 already registered · ERR-STU-005 no student profile
   */
  async apply(input: ApplyHostelInput, userId: string) {
    const window = await this.getWindow('hostel');
    if (!isRegistrationWindowOpen(window)) {
      throw new AppError('ERR-HST-001', 'Hostel registration window is not open.', 422);
    }
    const year = currentAcademicYear();

    const { rows: stuRows } = await pool.query(
      `SELECT student_id FROM students WHERE user_id = $1 AND is_active = TRUE`, [userId]);
    if (stuRows.length === 0) throw new AppError('ERR-STU-005', 'Student record not found.', 404);
    const studentId = stuRows[0].student_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the category row so the last seat can't double-book
      const { rows: catRows } = await client.query(
        `SELECT category_id, category_name, total_capacity FROM hostel_categories
          WHERE category_id = $1 AND is_active = TRUE FOR UPDATE`,
        [input.category_id],
      );
      if (catRows.length === 0) throw new AppError('ERR-HST-002', 'Hostel category not found.', 404);

      const { rows: liveRows } = await client.query(
        `SELECT 1 FROM hostel_registrations
          WHERE student_id = $1 AND academic_year = $2 AND status IN ('pending','approved')`,
        [studentId, year],
      );
      if (liveRows.length > 0) {
        throw new AppError('ERR-HST-003', 'You already have an active hostel registration this year.', 422);
      }

      const { rows: occRows } = await client.query(
        `SELECT COUNT(*)::int AS occupied FROM hostel_registrations
          WHERE category_id = $1 AND academic_year = $2 AND status IN ('pending','approved')`,
        [input.category_id, year],
      );
      if (occRows[0].occupied >= catRows[0].total_capacity) {
        throw new AppError('ERR-HST-002', 'The selected hostel category is full.', 422);
      }

      const { rows: regRows } = await client.query(
        `INSERT INTO hostel_registrations (student_id, category_id, academic_year, remarks)
         VALUES ($1, $2, $3, $4)
         RETURNING registration_id, status, created_at`,
        [studentId, input.category_id, year, input.remarks ?? null],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'HOSTEL_APPLIED', 'hostel_registration', $2, $3)`,
        [userId, String(regRows[0].registration_id),
         JSON.stringify({ category_id: input.category_id, year })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Hostel application submitted', registration: regRows[0].registration_id });
      return regRows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Student's own registration for the current year (with category info). */
  async getMyRegistration(userId: string) {
    const year = currentAcademicYear();
    const { rows } = await pool.query(
      `SELECT r.registration_id, r.status, r.remarks, r.academic_year, r.created_at, r.decided_at,
              c.category_name, c.fee_per_semester_paise, c.gender
         FROM hostel_registrations r
         JOIN hostel_categories c ON r.category_id = c.category_id
         JOIN students s ON r.student_id = s.student_id
        WHERE s.user_id = $1 AND r.academic_year = $2
        ORDER BY r.created_at DESC
        LIMIT 5`,
      [userId, year],
    );
    return { window: await this.getWindow('hostel'), registrations: rows };
  }

  // ── Staff processing ───────────────────────────────────────

  /** Pending queue for staff. */
  async listPending() {
    const year = currentAcademicYear();
    const { rows } = await pool.query(
      `SELECT r.registration_id, r.status, r.remarks, r.created_at,
              c.category_name, c.total_capacity,
              s.student_id, s.roll_number, u.first_name, u.last_name
         FROM hostel_registrations r
         JOIN hostel_categories c ON r.category_id = c.category_id
         JOIN students s ON r.student_id = s.student_id
         JOIN users u    ON s.user_id = u.user_id
        WHERE r.academic_year = $1 AND r.status = 'pending'
        ORDER BY r.created_at ASC`,
      [year],
    );
    return rows.map(r => ({
      registration_id: r.registration_id,
      category_name:   r.category_name,
      student_id:      r.student_id,
      roll_number:     r.roll_number,
      student_name:    `${r.first_name} ${r.last_name}`,
      remarks:         r.remarks,
      created_at:      r.created_at,
    }));
  }

  /**
   * Staff approves/rejects an application.
   * @throws ERR-HST-002 not found or already decided
   */
  async decide(input: DecideRegistrationInput, decidedBy: string) {
    const { rows } = await pool.query(
      `UPDATE hostel_registrations
          SET status = $1, remarks = COALESCE($2, remarks),
              decided_by = $3, decided_at = NOW(), updated_at = NOW()
        WHERE registration_id = $4 AND status = 'pending'
        RETURNING registration_id, status`,
      [input.decision, input.remarks ?? null, decidedBy, input.registration_id],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-HST-002', 'Registration not found or already decided.', 404);
    }

    await this.audit(decidedBy, 'HOSTEL_DECIDED', 'hostel_registration',
      String(input.registration_id), { decision: input.decision });
    return rows[0];
  }

  // ── Helpers ────────────────────────────────────────────────

  private async audit(userId: string, action: string, resourceType: string, resourceId: string, details: object) {
    try {
      await pool.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, action, resourceType, resourceId, JSON.stringify(details)],
      );
    } catch (err) {
      logger.error({ message: 'Audit log failed', action, error: (err as Error).message });
    }
  }
}

export const hostelService = new HostelService();
