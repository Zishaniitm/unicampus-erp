import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

/**
 * TimetableService — connects timetable_entries schema to API.
 * Week 5 additions: HOD can create/update/delete entries with conflict detection.
 */
export class TimetableService {

  /** Student's weekly timetable */
  async getStudentTimetable(userId: string) {
    const { rows: sr } = await pool.query(
      `SELECT s.batch_id, b.batch_name, b.academic_year, b.semester
       FROM students s JOIN batches b ON s.batch_id = b.batch_id
       WHERE s.user_id = $1 AND s.is_active = TRUE`,
      [userId],
    );
    if (!sr.length) return { batch_name: null, academic_year: null, semester: null, entries: [], time_slots: [] };
    const { batch_id, batch_name, academic_year, semester } = sr[0];

    const { rows: tr } = await pool.query(
      `SELECT timetable_id FROM timetables
       WHERE batch_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
      [batch_id],
    );
    if (!tr.length) return { batch_name, academic_year, semester, entries: [], time_slots: [] };

    return {
      batch_name, academic_year, semester,
      entries:    await this.getEntries(tr[0].timetable_id),
      time_slots: await this.getTimeSlots(),
    };
  }

  /** Teacher's weekly schedule */
  async getTeacherTimetable(userId: string) {
    const { rows: tr } = await pool.query(
      `SELECT teacher_id FROM teachers WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );
    if (!tr.length) return { entries: [] };

    const { rows } = await pool.query(
      `SELECT
         te.entry_id, te.day_of_week, te.is_cancelled, te.cancel_reason,
         ts.time_slot_id, ts.slot_name,
         ts.start_time::text AS start_time, ts.end_time::text AS end_time,
         c.course_name, c.course_code,
         cl.classroom_name, cl.building,
         b.batch_name, b.batch_id
       FROM timetable_entries te
       JOIN timetables tt       ON te.timetable_id    = tt.timetable_id
       JOIN time_slots ts       ON te.time_slot_id    = ts.time_slot_id
       JOIN batch_courses bc    ON te.batch_course_id = bc.batch_course_id
       JOIN courses c           ON bc.course_id       = c.course_id
       JOIN classrooms cl       ON te.classroom_id    = cl.classroom_id
       JOIN batches b           ON tt.batch_id        = b.batch_id
       WHERE te.teacher_id = $1 AND te.is_active = TRUE AND tt.is_active = TRUE
       ORDER BY te.day_of_week, ts.start_time`,
      [tr[0].teacher_id],
    );
    return { entries: rows };
  }

  /** Today's classes for current user */
  async getTodayClasses(userId: string, role: string) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
    if (role === 'STUDENT') {
      const full = await this.getStudentTimetable(userId);
      return (full.entries as any[]).filter(e => e.day_of_week === today);
    }
    if (['TEACHER', 'HOD'].includes(role)) {
      const full = await this.getTeacherTimetable(userId);
      return (full.entries as any[]).filter(e => e.day_of_week === today);
    }
    return [];
  }

  /**
   * HOD creates a new timetable entry.
   * Checks for: teacher clash, classroom clash, batch clash before inserting.
   */
  async createEntry(input: {
    timetable_id: number; day_of_week: string; time_slot_id: number;
    batch_course_id: number; classroom_id: number; teacher_id: number;
  }, createdBy: string) {
    const { timetable_id, day_of_week, time_slot_id, batch_course_id, classroom_id, teacher_id } = input;

    // Verify timetable exists and is active
    const { rows: ttRows } = await pool.query(
      `SELECT timetable_id, batch_id FROM timetables WHERE timetable_id = $1 AND is_active = TRUE`,
      [timetable_id],
    );
    if (!ttRows.length) throw new AppError('ERR-TT-004', 'Timetable not found.', 404);

    // ── Conflict checks ──────────────────────────────────────
    // 1. Teacher clash
    const { rows: teacherClash } = await pool.query(
      `SELECT te.entry_id FROM timetable_entries te
       JOIN timetables tt ON te.timetable_id = tt.timetable_id
       WHERE te.teacher_id = $1 AND te.day_of_week = $2
         AND te.time_slot_id = $3 AND te.is_active = TRUE AND tt.is_active = TRUE`,
      [teacher_id, day_of_week, time_slot_id],
    );
    if (teacherClash.length) {
      throw new AppError('ERR-TT-001', 'Teacher is already scheduled at this time slot.', 409);
    }

    // 2. Classroom clash
    const { rows: roomClash } = await pool.query(
      `SELECT te.entry_id FROM timetable_entries te
       JOIN timetables tt ON te.timetable_id = tt.timetable_id
       WHERE te.classroom_id = $1 AND te.day_of_week = $2
         AND te.time_slot_id = $3 AND te.is_active = TRUE AND tt.is_active = TRUE`,
      [classroom_id, day_of_week, time_slot_id],
    );
    if (roomClash.length) {
      throw new AppError('ERR-TT-002', 'Classroom is already booked at this time slot.', 409);
    }

    // 3. Batch clash
    const { rows: batchClash } = await pool.query(
      `SELECT te.entry_id FROM timetable_entries te
       WHERE te.timetable_id = $1 AND te.day_of_week = $2
         AND te.time_slot_id = $3 AND te.is_active = TRUE`,
      [timetable_id, day_of_week, time_slot_id],
    );
    if (batchClash.length) {
      throw new AppError('ERR-TT-003', 'This batch already has a class at this time slot.', 409);
    }

    // ── Insert ───────────────────────────────────────────────
    const { rows } = await pool.query(
      `INSERT INTO timetable_entries
         (timetable_id, day_of_week, time_slot_id, batch_course_id, classroom_id, teacher_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING entry_id`,
      [timetable_id, day_of_week, time_slot_id, batch_course_id, classroom_id, teacher_id],
    );

    await pool.query(
      `INSERT INTO audit.timetable_changes
         (timetable_id, entry_id, change_type, changed_by, new_data, change_reason)
       VALUES ($1, $2, 'CREATE', $3, $4, 'Entry created by HOD')`,
      [timetable_id, rows[0].entry_id, createdBy,
       JSON.stringify({ day_of_week, time_slot_id, batch_course_id, classroom_id, teacher_id })],
    );

    logger.info({ message: 'Timetable entry created', entry_id: rows[0].entry_id, by: createdBy });
    return { entry_id: rows[0].entry_id };
  }

  /** HOD cancels a class (soft delete — sets is_cancelled, not deleted) */
  async cancelEntry(entryId: number, reason: string, cancelledBy: string) {
    const { rows } = await pool.query(
      `SELECT entry_id, timetable_id FROM timetable_entries WHERE entry_id = $1`,
      [entryId],
    );
    if (!rows.length) throw new AppError('ERR-TT-004', 'Timetable entry not found.', 404);

    await pool.query(
      `UPDATE timetable_entries
       SET is_cancelled = TRUE, cancel_reason = $1, cancelled_by = $2, cancelled_at = NOW()
       WHERE entry_id = $3`,
      [reason, cancelledBy, entryId],
    );

    await pool.query(
      `INSERT INTO audit.timetable_changes
         (timetable_id, entry_id, change_type, changed_by, change_reason)
       VALUES ($1, $2, 'UPDATE', $3, $4)`,
      [rows[0].timetable_id, entryId, cancelledBy, `Class cancelled: ${reason}`],
    );
  }

  /** HOD creates a new timetable for a batch */
  async createTimetable(input: {
    batch_id: number; academic_year: string; semester: number;
    effective_from: string; effective_to?: string;
  }, createdBy: string) {
    // Deactivate any existing active timetable for this batch
    await pool.query(
      `UPDATE timetables SET is_active = FALSE
       WHERE batch_id = $1 AND is_active = TRUE`,
      [input.batch_id],
    );

    const { rows } = await pool.query(
      `INSERT INTO timetables
         (batch_id, academic_year, semester, effective_from, effective_to, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING timetable_id`,
      [input.batch_id, input.academic_year, input.semester,
       input.effective_from, input.effective_to ?? null, createdBy],
    );

    logger.info({ message: 'Timetable created', timetable_id: rows[0].timetable_id, by: createdBy });
    return { timetable_id: rows[0].timetable_id };
  }

  /** HOD gets list of timetables for their department */
  async getDeptTimetables(deptId: number) {
    const { rows } = await pool.query(
      `SELECT tt.timetable_id, tt.academic_year, tt.semester,
              tt.effective_from, tt.effective_to, tt.is_active,
              b.batch_name, b.section,
              COUNT(te.entry_id) AS entry_count
       FROM timetables tt
       JOIN batches b ON tt.batch_id = b.batch_id
       LEFT JOIN timetable_entries te ON tt.timetable_id = te.timetable_id AND te.is_active = TRUE
       WHERE b.department_id = $1
       GROUP BY tt.timetable_id, b.batch_name, b.section
       ORDER BY tt.is_active DESC, tt.created_at DESC`,
      [deptId],
    );
    return rows;
  }

  /** Get available resources for building a timetable entry */
  async getResources(deptId: number) {
    const [teachers, classrooms, timeSlots, batchCourses] = await Promise.all([
      pool.query(
        `SELECT t.teacher_id, CONCAT(u.first_name, ' ', u.last_name) AS name, t.designation
         FROM teachers t JOIN users u ON t.user_id = u.user_id
         WHERE t.department_id = $1 AND t.is_active = TRUE ORDER BY u.first_name`,
        [deptId],
      ),
      pool.query(
        `SELECT classroom_id, classroom_name, building, capacity, is_lab
         FROM classrooms WHERE is_active = TRUE ORDER BY building, classroom_name`,
      ),
      pool.query(
        `SELECT time_slot_id, slot_name, start_time::text, end_time::text
         FROM time_slots WHERE is_active = TRUE ORDER BY start_time`,
      ),
      pool.query(
        `SELECT bc.batch_course_id,
                c.course_name, c.course_code,
                b.batch_name, b.section,
                CONCAT(u.first_name, ' ', u.last_name) AS teacher_name
         FROM batch_courses bc
         JOIN courses c ON bc.course_id = c.course_id
         JOIN batches b ON bc.batch_id = b.batch_id
         JOIN teacher_courses tc ON bc.teacher_course_id = tc.teacher_course_id
         JOIN teachers t ON tc.teacher_id = t.teacher_id
         JOIN users u ON t.user_id = u.user_id
         WHERE b.department_id = $1 AND bc.is_active = TRUE
         ORDER BY b.batch_name, c.course_name`,
        [deptId],
      ),
    ]);

    return {
      teachers:     teachers.rows,
      classrooms:   classrooms.rows,
      time_slots:   timeSlots.rows,
      batch_courses: batchCourses.rows,
    };
  }

  private async getEntries(timetableId: number) {
    const { rows } = await pool.query(
      `SELECT
         te.entry_id, te.day_of_week, te.is_cancelled, te.cancel_reason,
         ts.time_slot_id, ts.slot_name,
         ts.start_time::text AS start_time, ts.end_time::text AS end_time,
         c.course_name, c.course_code,
         CONCAT(u.first_name, ' ', u.last_name) AS teacher_name,
         cl.classroom_name, cl.building
       FROM timetable_entries te
       JOIN time_slots ts   ON te.time_slot_id    = ts.time_slot_id
       JOIN batch_courses bc ON te.batch_course_id = bc.batch_course_id
       JOIN courses c        ON bc.course_id       = c.course_id
       JOIN teacher_courses tc ON bc.teacher_course_id = tc.teacher_course_id
       JOIN teachers t2      ON tc.teacher_id      = t2.teacher_id
       JOIN users u          ON t2.user_id         = u.user_id
       JOIN classrooms cl    ON te.classroom_id    = cl.classroom_id
       WHERE te.timetable_id = $1 AND te.is_active = TRUE
       ORDER BY te.day_of_week, ts.start_time`,
      [timetableId],
    );
    return rows;
  }

  private async getTimeSlots() {
    const { rows } = await pool.query(
      `SELECT time_slot_id, slot_name, start_time::text, end_time::text
       FROM time_slots WHERE is_active = TRUE ORDER BY start_time`,
    );
    return rows;
  }
}

export const timetableService = new TimetableService();
