import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { getTodayIST } from '../../utils/date.utils';

/**
 * TimetableService — connects existing timetable_entries schema to API.
 *
 * All queries use the existing tables from 05_timetable_and_substitution_tables.sql
 * plus timetable_entries created in migration 012.
 */
export class TimetableService {
  /**
   * Gets the weekly timetable for a student's current batch.
   * Students can only see their own batch's timetable.
   */
  async getStudentTimetable(userId: string) {
    // Get student's batch
    const { rows: studentRows } = await pool.query(
      `SELECT s.batch_id, s.student_id, b.batch_name, b.academic_year, b.semester
       FROM students s
       JOIN batches b ON s.batch_id = b.batch_id
       WHERE s.user_id = $1 AND s.is_active = TRUE`,
      [userId],
    );

    if (studentRows.length === 0) {
      throw new AppError('ERR-STU-005', 'Student profile not found.', 404);
    }

    const student = studentRows[0];

    // Get active timetable for this batch
    const { rows: timetableRows } = await pool.query(
      `SELECT timetable_id FROM timetables
       WHERE batch_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [student.batch_id],
    );

    if (timetableRows.length === 0) {
      return {
        batch_name:    student.batch_name,
        academic_year: student.academic_year,
        semester:      student.semester,
        entries:       [],
        time_slots:    [],
      };
    }

    const timetableId = timetableRows[0].timetable_id;
    const entries     = await this.getTimetableEntries(timetableId);
    const timeSlots   = await this.getTimeSlots();

    return {
      batch_name:    student.batch_name,
      academic_year: student.academic_year,
      semester:      student.semester,
      entries,
      time_slots: timeSlots,
    };
  }

  /**
   * Gets the weekly timetable for a teacher — all batches they teach.
   */
  async getTeacherTimetable(userId: string) {
    const { rows: teacherRows } = await pool.query(
      `SELECT teacher_id FROM teachers WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    if (teacherRows.length === 0) {
      throw new AppError('ERR-STU-005', 'Teacher profile not found.', 404);
    }

    const teacherId = teacherRows[0].teacher_id;

    const { rows: entries } = await pool.query(
      `SELECT
         te.entry_id, te.day_of_week, te.is_cancelled, te.cancel_reason,
         ts.slot_name, ts.start_time, ts.end_time, ts.time_slot_id,
         c.course_name, c.course_code,
         cl.classroom_name, cl.building,
         b.batch_name
       FROM timetable_entries te
       JOIN time_slots ts      ON te.time_slot_id    = ts.time_slot_id
       JOIN batch_courses bc   ON te.batch_course_id = bc.batch_course_id
       JOIN courses c          ON bc.course_id        = c.course_id
       JOIN classrooms cl      ON te.classroom_id     = cl.classroom_id
       JOIN timetables t       ON te.timetable_id     = t.timetable_id
       JOIN batches b          ON t.batch_id           = b.batch_id
       WHERE te.teacher_id = $1
         AND te.is_active = TRUE
         AND t.is_active  = TRUE
       ORDER BY te.day_of_week, ts.start_time`,
      [teacherId],
    );

    return {
      entries: entries.map(e => ({
        ...e,
        teacher_name: 'You',
        start_time:   e.start_time,
        end_time:     e.end_time,
      })),
    };
  }

  /**
   * Gets today's classes for the current user (student or teacher).
   */
  async getTodayClasses(userId: string, role: string) {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', timeZone: 'Asia/Kolkata',
    });

    if (role === 'STUDENT') {
      const full = await this.getStudentTimetable(userId);
      return full.entries.filter((e: any) => e.day_of_week === today);
    }

    if (role === 'TEACHER') {
      const full = await this.getTeacherTimetable(userId);
      return (full.entries as any[]).filter(e => e.day_of_week === today);
    }

    return [];
  }

  private async getTimetableEntries(timetableId: number) {
    const { rows } = await pool.query(
      `SELECT
         te.entry_id, te.day_of_week, te.is_cancelled, te.cancel_reason,
         ts.time_slot_id, ts.slot_name, ts.start_time::text AS start_time, ts.end_time::text AS end_time,
         c.course_name, c.course_code,
         CONCAT(u.first_name, ' ', u.last_name) AS teacher_name,
         cl.classroom_name, cl.building
       FROM timetable_entries te
       JOIN time_slots ts      ON te.time_slot_id    = ts.time_slot_id
       JOIN batch_courses bc   ON te.batch_course_id = bc.batch_course_id
       JOIN courses c          ON bc.course_id        = c.course_id
       JOIN teacher_courses tc ON bc.teacher_course_id = tc.teacher_course_id
       JOIN teachers t2        ON tc.teacher_id       = t2.teacher_id
       JOIN users u            ON t2.user_id           = u.user_id
       JOIN classrooms cl      ON te.classroom_id     = cl.classroom_id
       WHERE te.timetable_id = $1
         AND te.is_active = TRUE
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
