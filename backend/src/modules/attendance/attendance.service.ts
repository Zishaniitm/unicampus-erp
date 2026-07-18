import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import type { MarkAttendanceInput, EditAttendanceInput } from './attendance.types';

// Attendance edit window: faculty can edit within this many hours
const FACULTY_EDIT_WINDOW_HOURS = 24;

/**
 * AttendanceService — core attendance business logic.
 *
 * Business Rules (from SRS):
 * - Faculty can mark/edit attendance within 24h of class
 * - After 24h, only HOD can edit with mandatory reason (audited)
 * - ML and DL count as present for eligibility calculation
 * - Percentage = (Present + ML + DL) / Total × 100
 * - Below 75% triggers alert; below 60% blocks exam eligibility
 */
export class AttendanceService {

  /**
   * Marks attendance for an entire class session.
   * One record per student — upsert so re-marking within 24h is safe.
   *
   * @throws AppError ERR-TT-004 if timetable entry not found
   * @throws AppError ERR-AUTH-004 if teacher doesn't own this entry
   */
  async markAttendance(input: MarkAttendanceInput, markedBy: string, markerRole: string) {
    const { timetable_entry_id, att_date, records } = input;

    // Verify entry exists
    const { rows: entryRows } = await pool.query(
      `SELECT te.entry_id, te.teacher_id, t.teacher_id as teacher_id_check,
              u.user_id, te.timetable_id
       FROM timetable_entries te
       JOIN teachers t ON te.teacher_id = t.teacher_id
       JOIN users u ON t.user_id = u.user_id
       WHERE te.entry_id = $1`,
      [timetable_entry_id],
    );

    if (entryRows.length === 0) {
      throw new AppError('ERR-TT-004', 'Timetable entry not found.', 404);
    }

    // Teachers can only mark attendance for their own classes
    if (markerRole === 'TEACHER' && entryRows[0].user_id !== markedBy) {
      throw new AppError('ERR-AUTH-004', 'You can only mark attendance for your own classes.', 403);
    }

    // UPSERT all records in a single transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const record of records) {
        await client.query(
          `INSERT INTO attendance (timetable_entry_id, student_id, att_date, status, marked_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (timetable_entry_id, student_id, att_date)
           DO UPDATE SET
             status    = EXCLUDED.status,
             marked_by = EXCLUDED.marked_by,
             marked_at = NOW() AT TIME ZONE 'Asia/Kolkata'`,
          [timetable_entry_id, record.student_id, att_date, record.status, markedBy],
        );
      }

      // Audit log
      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, details)
         VALUES ($1, 'ATTENDANCE_MARKED', 'attendance', $2)`,
        [markedBy, JSON.stringify({ timetable_entry_id, att_date, count: records.length })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Attendance marked', entry: timetable_entry_id, date: att_date, records: records.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { marked: records.length };
  }

  /**
   * Edits a single attendance record.
   * Faculty: only within 24h of marking.
   * HOD/Admin: anytime, but reason is mandatory.
   *
   * @throws AppError ERR-ATT-001 if outside edit window (for faculty)
   */
  async editAttendance(input: EditAttendanceInput, editorUserId: string, editorRole: string) {
    const { att_id, status, edit_reason } = input;

    const { rows } = await pool.query(
      `SELECT a.att_id, a.marked_at, a.timetable_entry_id,
              te.teacher_id, t.user_id as teacher_user_id
       FROM attendance a
       JOIN timetable_entries te ON a.timetable_entry_id = te.entry_id
       JOIN teachers t ON te.teacher_id = t.teacher_id
       WHERE a.att_id = $1`,
      [att_id],
    );

    if (rows.length === 0) {
      throw new AppError('ERR-ATT-003', 'Attendance record not found.', 404);
    }

    const record = rows[0];
    const hoursSinceMarked =
      (Date.now() - new Date(record.marked_at).getTime()) / (1000 * 60 * 60);

    // Faculty edit window check
    if (markerRoleIsTeacher(editorRole)) {
      if (record.teacher_user_id !== editorUserId) {
        throw new AppError('ERR-AUTH-004', 'You can only edit attendance for your own classes.', 403);
      }
      if (hoursSinceMarked > FACULTY_EDIT_WINDOW_HOURS) {
        throw new AppError(
          'ERR-ATT-001',
          `Attendance edit window has closed (${FACULTY_EDIT_WINDOW_HOURS}h). Contact your HOD to make changes.`,
          422,
        );
      }
    }

    // HOD/Admin must always provide a reason
    if (!edit_reason || edit_reason.trim().length < 10) {
      throw new AppError('ERR-ATT-001', 'Edit reason must be at least 10 characters.', 400);
    }

    await pool.query(
      `UPDATE attendance
       SET status = $1, edited_by = $2, edit_reason = $3,
           edited_at = NOW() AT TIME ZONE 'Asia/Kolkata'
       WHERE att_id = $4`,
      [status, editorUserId, edit_reason.trim(), att_id],
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'ATTENDANCE_EDITED', 'attendance', $2, $3)`,
      [editorUserId, att_id.toString(), JSON.stringify({ new_status: status, reason: edit_reason })],
    );
  }

  /**
   * Returns subject-wise attendance summary for a student.
   * Used by student dashboard and attendance page.
   *
   * Percentage formula: (P + ML + DL) / Total × 100
   * ML and DL count as present for eligibility purposes.
   */
  async getStudentSummary(userId: string) {
    // Get student_id from user_id
    const { rows: studentRows } = await pool.query(
      `SELECT s.student_id, s.batch_id FROM students s WHERE s.user_id = $1`,
      [userId],
    );

    // Non-student roles (admin, teacher, HOD etc.) have no student profile — return empty gracefully
    if (studentRows.length === 0) {
      return [];
    }

    const studentId = studentRows[0].student_id;

    const { rows } = await pool.query(
      `SELECT
         c.course_code,
         c.course_name,
         COUNT(*)                                              AS total_classes,
         COUNT(*) FILTER (WHERE a.status = 'P')              AS present,
         COUNT(*) FILTER (WHERE a.status = 'A')              AS absent,
         COUNT(*) FILTER (WHERE a.status = 'ML')             AS medical_leave,
         COUNT(*) FILTER (WHERE a.status = 'DL')             AS duty_leave,
         ROUND(
           COUNT(*) FILTER (WHERE a.status IN ('P','ML','DL'))::numeric
           / NULLIF(COUNT(*), 0) * 100, 2
         )                                                     AS percentage
       FROM attendance a
       JOIN timetable_entries te ON a.timetable_entry_id = te.entry_id
       JOIN batch_courses bc     ON te.batch_course_id = bc.batch_course_id
       JOIN courses c            ON bc.course_id = c.course_id
       WHERE a.student_id = $1
       GROUP BY c.course_id, c.course_code, c.course_name
       ORDER BY c.course_name`,
      [studentId],
    );

    return rows.map(r => ({
      course_code:   r.course_code,
      course_name:   r.course_name,
      total:         parseInt(r.total_classes, 10),
      present:       parseInt(r.present, 10),
      absent:        parseInt(r.absent, 10),
      medical_leave: parseInt(r.medical_leave, 10),
      duty_leave:    parseInt(r.duty_leave, 10),
      percentage:    parseFloat(r.percentage ?? '0'),
    }));
  }

  /**
   * Returns the class roster for a timetable entry on a specific date.
   * Used by teachers on the attendance marking page.
   */
  async getClassRoster(timetableEntryId: number, date: string, teacherUserId: string) {
    // Verify teacher owns this entry
    const { rows: entryRows } = await pool.query(
      `SELECT te.entry_id, t.user_id,
              c.course_name, c.course_code,
              ts.start_time::text, ts.end_time::text, ts.slot_name,
              te.day_of_week
       FROM timetable_entries te
       JOIN teachers t  ON te.teacher_id = t.teacher_id
       JOIN batch_courses bc ON te.batch_course_id = bc.batch_course_id
       JOIN courses c   ON bc.course_id = c.course_id
       JOIN time_slots ts ON te.time_slot_id = ts.time_slot_id
       WHERE te.entry_id = $1`,
      [timetableEntryId],
    );

    if (entryRows.length === 0) {
      throw new AppError('ERR-TT-004', 'Timetable entry not found.', 404);
    }

    const entry = entryRows[0];

    // Get students in this batch with existing attendance for this date
    const { rows: students } = await pool.query(
      `SELECT
         s.student_id,
         u.first_name, u.last_name,
         s.roll_number,
         a.status,
         a.att_id
       FROM timetable_entries te
       JOIN timetables tt ON te.timetable_id = tt.timetable_id
       JOIN students s    ON s.batch_id = tt.batch_id AND s.is_active = TRUE
       JOIN users u       ON s.user_id = u.user_id
       LEFT JOIN attendance a ON (
         a.timetable_entry_id = te.entry_id
         AND a.student_id = s.student_id
         AND a.att_date = $2
       )
       WHERE te.entry_id = $1
       ORDER BY s.roll_number`,
      [timetableEntryId, date],
    );

    return {
      entry: {
        entry_id:    entry.entry_id,
        course_name: entry.course_name,
        course_code: entry.course_code,
        start_time:  entry.start_time,
        end_time:    entry.end_time,
        slot_name:   entry.slot_name,
        day_of_week: entry.day_of_week,
      },
      date,
      students: students.map(s => ({
        student_id: s.student_id,
        roll_number: s.roll_number,
        name: `${s.first_name} ${s.last_name}`,
        status: s.status ?? null,   // null = not yet marked
        att_id: s.att_id ?? null,
      })),
      already_marked: students.some(s => s.status !== null),
    };
  }

  /**
   * Returns batch-wise attendance summary for HOD view.
   */
  async getBatchSummary(batchId: number, fromDate?: string, toDate?: string) {
    const dateFilter = fromDate && toDate
      ? `AND a.att_date BETWEEN '${fromDate}' AND '${toDate}'`
      : '';

    const { rows } = await pool.query(
      `SELECT
         s.student_id, s.roll_number,
         u.first_name, u.last_name,
         COUNT(a.att_id)                                       AS total_classes,
         COUNT(*) FILTER (WHERE a.status IN ('P','ML','DL'))  AS effective_present,
         COUNT(*) FILTER (WHERE a.status = 'A')              AS absent,
         ROUND(
           COUNT(*) FILTER (WHERE a.status IN ('P','ML','DL'))::numeric
           / NULLIF(COUNT(a.att_id), 0) * 100, 2
         )                                                     AS percentage
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       LEFT JOIN attendance a ON a.student_id = s.student_id ${dateFilter}
       WHERE s.batch_id = $1 AND s.is_active = TRUE
       GROUP BY s.student_id, s.roll_number, u.first_name, u.last_name
       ORDER BY percentage ASC NULLS LAST`,
      [batchId],
    );

    return rows.map(r => ({
      student_id:       r.student_id,
      roll_number:      r.roll_number,
      name:             `${r.first_name} ${r.last_name}`,
      total_classes:    parseInt(r.total_classes, 10),
      effective_present: parseInt(r.effective_present, 10),
      absent:           parseInt(r.absent, 10),
      percentage:       parseFloat(r.percentage ?? '0'),
      alert:            parseFloat(r.percentage ?? '0') < 75,
    }));
  }
}

function markerRoleIsTeacher(role: string): boolean {
  return role === 'TEACHER';
}

export const attendanceService = new AttendanceService();
