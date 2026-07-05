import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';

/**
 * NoticeService — manages the notice board.
 * Notices are filtered by role and department of the requesting user.
 */
export class NoticeService {
  /**
   * Gets notices visible to the current user, newest first.
   * Filters by: target_role (null = all roles) AND target_dept (null = all depts).
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
         n.created_at
       FROM notices n
       JOIN users u ON n.posted_by = u.user_id
       WHERE n.is_active = TRUE
         AND (n.visible_from IS NULL OR n.visible_from <= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.visible_to   IS NULL OR n.visible_to   >= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.target_role IS NULL OR n.target_role = $1)
         AND (n.target_dept IS NULL OR n.target_dept = $2)
       ORDER BY n.is_critical DESC, n.created_at DESC
       LIMIT $3 OFFSET $4`,
      [role, deptId, per_page, offset],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM notices n
       WHERE n.is_active = TRUE
         AND (n.visible_from IS NULL OR n.visible_from <= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.visible_to   IS NULL OR n.visible_to   >= NOW() AT TIME ZONE 'Asia/Kolkata')
         AND (n.target_role IS NULL OR n.target_role = $1)
         AND (n.target_dept IS NULL OR n.target_dept = $2)`,
      [role, deptId],
    );

    const total = parseInt(countRows[0].count, 10);
    return {
      notices: rows,
      meta: { page, per_page, total, total_pages: Math.ceil(total / per_page) },
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
    return { notice_id: rows[0].notice_id };
  }
}

export const noticeService = new NoticeService();
