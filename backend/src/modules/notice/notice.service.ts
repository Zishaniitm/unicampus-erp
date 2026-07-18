import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

/**
 * NoticeService — manages the notice board.
 * Notices are filtered by role and department of the requesting user.
 * Week 6: unread indicator (notice_reads), mark-as-read, deactivate,
 * my-posted list for staff management view.
 */
export class NoticeService {
  /**
   * Gets notices visible to the current user, newest first.
   * Filters by: target_role (null = all roles) AND target_dept (null = all depts).
   * is_read powers the unread indicator (FR-NOT-002).
   */
  async listNotices(userId: string, role: string, query: {
    page: number; per_page: number;
  }) {
    const { page, per_page } = query;
    const offset = (page - 1) * per_page;

    // Get user's department if they're a student/teacher
    const { rows: deptRows } = await pool.query(
      `SELECT d.department_id FROM users u
       LEFT JOIN students s ON u.user_id = s.user_id
       LEFT JOIN batches b  ON s.batch_id = b.batch_id
       LEFT JOIN teachers t ON u.user_id = t.user_id
       LEFT JOIN departments d ON (b.department_id = d.department_id OR t.department_id = d.department_id)
       WHERE u.user_id = $1 LIMIT 1`,
      [userId],
    );
    const deptId = deptRows[0]?.department_id ?? null;

    const { rows } = await pool.query(
      `SELECT
         n.notice_id, n.title, n.body, n.is_critical,
         n.visible_from, n.visible_to,
         CONCAT(u.first_name, ' ', u.last_name) AS posted_by,
         n.target_role, n.target_dept, n.target_batch,
         n.created_at,
         (nr.notice_id IS NOT NULL) AS is_read
       FROM notices n
       JOIN users u ON n.posted_by = u.user_id
       LEFT JOIN notice_reads nr ON nr.notice_id = n.notice_id AND nr.user_id = $3
       WHERE n.is_active = TRUE
         AND (n.visible_from IS NULL OR n.visible_from <= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.visible_to   IS NULL OR n.visible_to   >= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.target_role IS NULL OR n.target_role = $1)
         AND (n.target_dept IS NULL OR n.target_dept = $2)
       ORDER BY n.is_critical DESC, n.created_at DESC
       LIMIT $4 OFFSET $5`,
      [role, deptId, userId, per_page, offset],
    );

    const { rows: countRows } = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE nr.notice_id IS NULL) AS unread
       FROM notices n
       LEFT JOIN notice_reads nr ON nr.notice_id = n.notice_id AND nr.user_id = $3
       WHERE n.is_active = TRUE
         AND (n.visible_from IS NULL OR n.visible_from <= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.visible_to   IS NULL OR n.visible_to   >= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.target_role IS NULL OR n.target_role = $1)
         AND (n.target_dept IS NULL OR n.target_dept = $2)`,
      [role, deptId, userId],
    );

    const total  = parseInt(countRows[0].total, 10);
    const unread = parseInt(countRows[0].unread, 10);
    return {
      notices: rows,
      meta: { page, per_page, total, unread, total_pages: Math.ceil(total / per_page) },
    };
  }

  /** Creates a new notice. Poster must be SUPER_ADMIN, HOD, PRINCIPAL, or STAFF. */
  async createNotice(input: {
    title: string; body: string; is_critical: boolean;
    target_role?: string; target_dept?: number; target_batch?: number;
    visible_from?: string; visible_to?: string;
  }, postedBy: string) {
    const { rows } = await pool.query(
      `INSERT INTO notices (title, body, is_critical, target_role, target_dept, target_batch,
                            visible_from, visible_to, posted_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
       RETURNING notice_id`,
      [input.title, input.body, input.is_critical ?? false,
       input.target_role ?? null, input.target_dept ?? null, input.target_batch ?? null,
       input.visible_from ?? null, input.visible_to ?? null, postedBy],
    );

    logger.info({ message: 'Notice posted', notice_id: rows[0].notice_id, critical: input.is_critical ?? false });
    return { notice_id: rows[0].notice_id };
  }

  /** Marks a notice as read for the current user. Idempotent. */
  async markRead(noticeId: number, userId: string) {
    const { rows } = await pool.query(
      `SELECT notice_id FROM notices WHERE notice_id = $1 AND is_active = TRUE`,
      [noticeId],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-NOT-001', 'Notice not found.', 404);
    }

    await pool.query(
      `INSERT INTO notice_reads (notice_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [noticeId, userId],
    );
    return { notice_id: noticeId, read: true };
  }

  /**
   * Notices posted by the current user (management view for staff/HOD).
   * Includes inactive ones so posters can see what they've taken down.
   */
  async listMyPosted(userId: string, query: { page: number; per_page: number }) {
    const { page, per_page } = query;
    const offset = (page - 1) * per_page;

    const { rows } = await pool.query(
      `SELECT n.notice_id, n.title, n.body, n.is_critical, n.is_active,
              n.target_role, n.target_dept, n.target_batch,
              n.visible_from, n.visible_to, n.created_at,
              (SELECT COUNT(*) FROM notice_reads nr WHERE nr.notice_id = n.notice_id) AS read_count
       FROM notices n
       WHERE n.posted_by = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, per_page, offset],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM notices WHERE posted_by = $1`,
      [userId],
    );

    const total = parseInt(countRows[0].count, 10);
    return {
      notices: rows.map(r => ({ ...r, read_count: parseInt(r.read_count, 10) })),
      meta: { page, per_page, total, total_pages: Math.ceil(total / per_page) },
    };
  }

  /**
   * Deactivates (takes down) a notice. Only the original poster,
   * PRINCIPAL, or SUPER_ADMIN may do this.
   *
   * @throws AppError ERR-NOT-001 if notice not found
   * @throws AppError ERR-AUTH-004 if caller may not deactivate it
   */
  async deactivateNotice(noticeId: number, userId: string, role: string) {
    const { rows } = await pool.query(
      `SELECT notice_id, posted_by, is_active FROM notices WHERE notice_id = $1`,
      [noticeId],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-NOT-001', 'Notice not found.', 404);
    }

    const isOwner = rows[0].posted_by === userId;
    const isAdmin = role === 'SUPER_ADMIN' || role === 'PRINCIPAL';
    if (!isOwner && !isAdmin) {
      throw new AppError('ERR-AUTH-004', 'You can only take down notices you posted.', 403);
    }

    await pool.query(
      `UPDATE notices SET is_active = FALSE, updated_at = NOW() WHERE notice_id = $1`,
      [noticeId],
    );

    logger.info({ message: 'Notice deactivated', notice_id: noticeId, by: userId });
    return { notice_id: noticeId, is_active: false };
  }
}

export const noticeService = new NoticeService();
