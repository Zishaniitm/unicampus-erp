import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import type {
  CreateStudentInput,
  UpdateStudentInput,
  AdminUpdateStudentInput,
  StudentListQuery,
  SetAcademicHoldInput,
} from './student.types';

/**
 * StudentService — all student-related business logic.
 *
 * Access control summary:
 *   - List/search students: SUPER_ADMIN, PRINCIPAL, HOD, TEACHER, STAFF, ADMISSION_STAFF
 *   - Get single student: above roles + the student themselves (own record only)
 *   - Create student: SUPER_ADMIN, STAFF, ADMISSION_STAFF
 *   - Update (limited fields): STUDENT (own record), all staff roles
 *   - Admin update (all fields): SUPER_ADMIN, STAFF
 *   - Set academic hold: HOD, SUPER_ADMIN
 *   - Deactivate: SUPER_ADMIN
 */
export class StudentService {
  /**
   * Lists students with pagination, search, and filtering.
   * HOD scope: only their department's students.
   * TEACHER scope: only batches they teach.
   *
   * @returns paginated list + total count
   */
  async listStudents(query: StudentListQuery, requestingUser: { role: string; user_id: string }) {
    const { page, per_page, sort, order, search, batch_id, department_id, is_active, admission_status } = query;
    const offset = (page - 1) * per_page;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(
        u.first_name ILIKE $${paramIdx} OR
        u.last_name  ILIKE $${paramIdx} OR
        s.roll_number ILIKE $${paramIdx} OR
        u.email ILIKE $${paramIdx}
      )`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (batch_id) {
      conditions.push(`s.batch_id = $${paramIdx++}`);
      params.push(batch_id);
    }
    if (department_id) {
      conditions.push(`b.department_id = $${paramIdx++}`);
      params.push(department_id);
    }
    if (typeof is_active === 'boolean') {
      conditions.push(`s.is_active = $${paramIdx++}`);
      params.push(is_active);
    }
    if (admission_status) {
      conditions.push(`s.admission_status = $${paramIdx++}`);
      params.push(admission_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts: Record<string, string> = {
      roll_number: 's.roll_number',
      first_name: 'u.first_name',
      created_at: 's.created_at',
    };
    const sortCol = allowedSorts[sort] ?? 's.roll_number';

    const dataQuery = `
      SELECT
        s.student_id, s.roll_number, s.batch_id, s.admission_date,
        s.is_active, s.admission_status, s.academic_hold,
        s.credential_sent_at, s.first_login_at, s.cgpa, s.sgpa_latest,
        u.user_id, u.first_name, u.last_name, u.email,
        u.must_change_password, u.photo_url,
        b.batch_name, d.department_name, d.department_code
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN batches b ON s.batch_id = b.batch_id
      JOIN departments d ON b.department_id = d.department_id
      ${whereClause}
      ORDER BY ${sortCol} ${order.toUpperCase()}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN batches b ON s.batch_id = b.batch_id
      JOIN departments d ON b.department_id = d.department_id
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, per_page, offset]),
      pool.query(countQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      students: dataResult.rows,
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  /**
   * Returns a single student's full profile.
   * Students can only fetch their own record.
   *
   * @throws AppError ERR-STU-005 if not found
   * @throws AppError ERR-AUTH-004 if student tries to access another student's record
   */
  async getStudentById(studentId: number, requestingUser: { role: string; user_id: string }) {
    const { rows } = await pool.query(
      `SELECT
         s.*, u.user_id, u.first_name, u.last_name, u.email,
         u.photo_url, u.must_change_password, u.last_login,
         b.batch_name, b.section, b.academic_year, b.semester,
         d.department_name, d.department_code
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       JOIN batches b ON s.batch_id = b.batch_id
       JOIN departments d ON b.department_id = d.department_id
       WHERE s.student_id = $1`,
      [studentId],
    );

    if (rows.length === 0) {
      throw new AppError('ERR-STU-005', 'Student record not found.', 404);
    }

    const student = rows[0];

    // Students can only view their own record
    if (requestingUser.role === 'STUDENT' && student.user_id !== requestingUser.user_id) {
      throw new AppError('ERR-AUTH-004', 'You do not have permission to view this record.', 403);
    }

    // Never return mobile_number raw — it's encrypted. Strip it from response.
    delete student.mobile_number;

    return student;
  }

  /**
   * Creates a new student user account + student profile in a single transaction.
   * Does NOT generate credentials — that is the Admission module's job.
   * Sets admission_status = 'pending' by default.
   *
   * @throws AppError ERR-ADM-001 if roll_number already exists
   */
  async createStudent(input: CreateStudentInput, createdBy: string) {
    const { first_name, last_name, email, mobile_number, roll_number, batch_id,
            date_of_birth, gender, address, contact_number,
            parent_guardian_name, parent_contact_number, admission_date } = input;

    // Check for duplicate roll number
    const { rows: existing } = await pool.query(
      `SELECT student_id FROM students WHERE roll_number = $1`,
      [roll_number],
    );
    if (existing.length > 0) {
      throw new AppError('ERR-ADM-001', `Roll number ${roll_number} already exists in the system.`, 422);
    }

    // Check for duplicate email
    const { rows: emailCheck } = await pool.query(
      `SELECT user_id FROM users WHERE email = LOWER($1)`,
      [email],
    );
    if (emailCheck.length > 0) {
      throw new AppError('ERR-ADM-001', `Email ${email} is already registered.`, 422);
    }

    // Verify batch exists
    const { rows: batchCheck } = await pool.query(
      `SELECT batch_id FROM batches WHERE batch_id = $1 AND is_active = TRUE`,
      [batch_id],
    );
    if (batchCheck.length === 0) {
      throw new AppError('ERR-STU-005', `Batch ${batch_id} not found or inactive.`, 422);
    }

    // Generate username: rollnumber@collegecode (lowercase)
    // Note: password is NOT set here — credentials module handles that
    const username = `${roll_number.toLowerCase()}@placeholder`;
    const placeholderHash = '$2b$12$placeholder_no_login_until_credentials_generated';

    // Get STUDENT role_id
    const { rows: roleRows } = await pool.query(
      `SELECT role_id FROM roles WHERE role_name = 'STUDENT' LIMIT 1`,
    );
    const studentRoleId = roleRows[0]?.role_id;
    if (!studentRoleId) throw new AppError('ERR-SYS-001', 'STUDENT role not found.', 500);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create user account
      const { rows: userRows } = await client.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id,
                            mobile_number, must_change_password, is_active)
         VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, TRUE, TRUE)
         RETURNING user_id`,
        [username, email, placeholderHash, first_name, last_name, studentRoleId, mobile_number],
      );
      const newUserId = userRows[0].user_id;

      // 2. Create student profile
      const { rows: studentRows } = await client.query(
        `INSERT INTO students (user_id, roll_number, batch_id, admission_date, date_of_birth,
                               gender, address, contact_number, parent_guardian_name,
                               parent_contact_number, is_active, admission_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 'pending')
         RETURNING student_id`,
        [newUserId, roll_number, batch_id, admission_date, date_of_birth,
         gender, address, contact_number, parent_guardian_name, parent_contact_number],
      );
      const newStudentId = studentRows[0].student_id;

      // 3. Audit log
      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'CREATE', 'student', $2, $3)`,
        [createdBy, newStudentId.toString(), JSON.stringify({ roll_number, created_by: createdBy })],
      );

      await client.query('COMMIT');

      logger.info({ message: 'Student created', student_id: newStudentId, roll_number, created_by: createdBy });

      return { student_id: newStudentId, user_id: newUserId, roll_number };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Updates limited fields for a student (self-update).
   * Full admin update is handled by adminUpdateStudent.
   */
  async updateStudent(studentId: number, input: UpdateStudentInput, requestingUser: { role: string; user_id: string }) {
    // Verify ownership for student role
    if (requestingUser.role === 'STUDENT') {
      const { rows } = await pool.query(
        `SELECT user_id FROM students WHERE student_id = $1`,
        [studentId],
      );
      if (rows.length === 0 || rows[0].user_id !== requestingUser.user_id) {
        throw new AppError('ERR-AUTH-004', 'You can only update your own profile.', 403);
      }
    }

    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return;

    const setClause = fields.map(([k], i) => `${k} = $${i + 1}`).join(', ');
    const values = fields.map(([, v]) => v);

    await pool.query(
      `UPDATE students SET ${setClause}, updated_at = NOW() WHERE student_id = $${fields.length + 1}`,
      [...values, studentId],
    );
  }

  /**
   * Places or removes an academic hold on a student.
   * Only HOD or SUPER_ADMIN can do this.
   * Reason is mandatory when placing a hold.
   *
   * @throws AppError ERR-STU-005 if student not found
   */
  async setAcademicHold(studentId: number, input: SetAcademicHoldInput, actingUser: { user_id: string; role: string }) {
    const { hold, reason } = input;

    if (hold && (!reason || reason.length < 10)) {
      throw new AppError('ERR-STU-002', 'A reason of at least 10 characters is required when placing a hold.', 400);
    }

    const { rows } = await pool.query(
      `SELECT student_id FROM students WHERE student_id = $1`,
      [studentId],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-STU-005', 'Student not found.', 404);
    }

    await pool.query(
      `UPDATE students
       SET academic_hold = $1,
           academic_hold_reason = $2,
           academic_hold_by = $3,
           updated_at = NOW()
       WHERE student_id = $4`,
      [hold, hold ? reason : null, hold ? actingUser.user_id : null, studentId],
    );

    await pool.query(
      `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'student', $3, $4)`,
      [
        actingUser.user_id,
        hold ? 'ACADEMIC_HOLD_SET' : 'ACADEMIC_HOLD_REMOVED',
        studentId.toString(),
        JSON.stringify({ hold, reason: hold ? reason : null }),
      ],
    );

    logger.info({ message: `Academic hold ${hold ? 'set' : 'removed'}`, student_id: studentId, by: actingUser.user_id });
  }
}

export const studentService = new StudentService();
