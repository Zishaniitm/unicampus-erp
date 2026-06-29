import crypto from 'crypto';
import bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import type { BulkImportRow, GenerateCredInput } from './admission.types';
import { BulkImportRowSchema } from './admission.types';

interface BulkImportError {
  row: number;
  field: string;
  error: string;
}

interface OnboardingCounts {
  not_generated:   number;   // credential_sent_at IS NULL
  sent_not_logged: number;   // sent but first_login_at IS NULL
  logged_in:       number;   // first_login_at set but must_change_password TRUE
  fully_onboarded: number;   // must_change_password FALSE
  total:           number;
}

/**
 * AdmissionService — manages student onboarding and credential lifecycle.
 *
 * Credential generation flow (strict, never deviate):
 *  1. Student admission_status must be 'confirmed'
 *  2. Generate username = rollnumber@COLLEGE_CODE (lowercase)
 *  3. Generate temp password = 10 chars (crypto.randomBytes, base64url)
 *  4. bcrypt hash immediately — plaintext NEVER stored
 *  5. Send via SMS + email
 *  6. Set must_change_password = TRUE, credential_sent_at = NOW()
 */
export class AdmissionService {
  /**
   * Generates credentials for one or more confirmed students.
   * Returns array of { student_id, username, plaintext_password } — caller must SMS/email these.
   * Plaintext passwords are NOT stored after this function returns.
   *
   * @throws AppError ERR-ADM-002 if any student's admission_status !== 'confirmed'
   */
  async generateCredentials(input: GenerateCredInput, actingUserId: string) {
    const { student_ids } = input;

    // Fetch all students in one query
    const placeholders = student_ids.map((_, i) => `$${i + 1}`).join(', ');
    const { rows: students } = await pool.query(
      `SELECT s.student_id, s.roll_number, s.admission_status, s.credential_sent_at,
              u.user_id, u.first_name, u.email, u.mobile_number
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       WHERE s.student_id IN (${placeholders})`,
      student_ids,
    );

    if (students.length === 0) {
      throw new AppError('ERR-STU-005', 'No students found for the given IDs.', 404);
    }

    // Validate all students are confirmed before generating any credentials
    const unconfirmed = students.filter((s: any) => s.admission_status !== 'confirmed');
    if (unconfirmed.length > 0) {
      throw new AppError(
        'ERR-ADM-002',
        `${unconfirmed.length} student(s) have not been confirmed yet: ${unconfirmed.map((s: any) => s.roll_number).join(', ')}. Confirm admission first.`,
        422,
      );
    }

    const results: Array<{ student_id: number; username: string; plaintext_password: string; mobile: string; email: string; name: string }> = [];

    for (const student of students) {
      // Generate username: rollnumber@FUGS (lowercase, no spaces)
      const username = `${student.roll_number.toLowerCase().replace(/\s/g, '')}@${env.COLLEGE_CODE.toLowerCase()}`;

      // Generate cryptographically secure temp password — 10 chars, base64url (alphanumeric + - _)
      const plaintext_password = crypto.randomBytes(8).toString('base64url').slice(0, 10);

      // Hash IMMEDIATELY — never store plaintext
      const password_hash = await bcrypt.hash(plaintext_password, env.BCRYPT_ROUNDS);

      // Update user with new credentials
      await pool.query(
        `UPDATE users
         SET username = $1,
             password_hash = $2,
             must_change_password = TRUE,
             onboarding_completed = FALSE
         WHERE user_id = $3`,
        [username, password_hash, student.user_id],
      );

      // Mark credential as sent
      await pool.query(
        `UPDATE students
         SET credential_sent_at = NOW() AT TIME ZONE 'Asia/Kolkata'
         WHERE student_id = $1`,
        [student.student_id],
      );

      // Audit log
      await pool.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'CREDENTIALS_GENERATED', 'student', $2, $3)`,
        [actingUserId, student.student_id.toString(), JSON.stringify({ username, generated_by: actingUserId })],
      );

      results.push({
        student_id: student.student_id,
        username,
        plaintext_password,   // Returned to caller for SMS/email dispatch ONLY
        mobile: student.mobile_number,
        email: student.email,
        name: student.first_name,
      });
    }

    logger.info({ message: 'Credentials generated', count: results.length, by: actingUserId });
    return results;
    // After this point, plaintext_password exists nowhere in the system
  }

  /**
   * Validates and imports students in bulk from an Excel file.
   * ALL-OR-NOTHING: if any row has errors, NO rows are inserted.
   * Returns an error report Excel buffer if there are validation errors.
   *
   * @param fileBuffer - raw Excel file buffer from multer upload
   * @returns { success: true, imported: number } or { success: false, errorReport: Buffer }
   */
  async bulkImport(fileBuffer: Buffer, actingUserId: string): Promise<
    | { success: true; imported: number; skipped: number }
    | { success: false; errorReport: Buffer; errorCount: number }
  > {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const sheet = workbook.getWorksheet(1);

    if (!sheet) {
      throw new AppError('ERR-ADM-003', 'Excel file has no worksheets.', 400);
    }

    // Expect headers in row 1, data from row 2
    const EXPECTED_HEADERS = [
      'roll_number', 'first_name', 'last_name', 'email', 'mobile_number',
      'date_of_birth', 'gender', 'batch_name', 'department_code',
      'parent_guardian_name', 'parent_contact_number', 'admission_date', 'category',
    ];

    const headerRow = sheet.getRow(1).values as string[];
    const headers = headerRow.slice(1); // ExcelJS is 1-indexed

    // Pre-load lookup data
    const { rows: batches } = await pool.query(`SELECT batch_id, batch_name FROM batches WHERE is_active = TRUE`);
    const { rows: departments } = await pool.query(`SELECT department_id, department_code FROM departments WHERE is_active = TRUE`);
    const batchMap = new Map(batches.map((b: any) => [b.batch_name, b.batch_id]));
    const deptMap  = new Map(departments.map((d: any) => [d.department_code.toUpperCase(), d.department_id]));

    const errors: BulkImportError[] = [];
    const validatedRows: Array<BulkImportRow & { batch_id: number }> = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rawData: Record<string, string> = {};
      headers.forEach((header, i) => {
        const cell = row.getCell(i + 1);
        rawData[header] = cell.value?.toString().trim() ?? '';
      });

      // Zod validation
      const parsed = BulkImportRowSchema.safeParse(rawData);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        Object.entries(fieldErrors).forEach(([field, msgs]) => {
          errors.push({ row: rowNumber, field, error: (msgs as string[]).join('; ') });
        });
        return;
      }

      // Resolve batch_name → batch_id
      const batchId = batchMap.get(parsed.data.batch_name);
      if (!batchId) {
        errors.push({ row: rowNumber, field: 'batch_name', error: `Batch "${parsed.data.batch_name}" not found.` });
        return;
      }

      // Resolve department_code → department_id
      const deptId = deptMap.get(parsed.data.department_code.toUpperCase());
      if (!deptId) {
        errors.push({ row: rowNumber, field: 'department_code', error: `Department "${parsed.data.department_code}" not found.` });
        return;
      }

      validatedRows.push({ ...parsed.data, batch_id: batchId });
    });

    // Check for duplicate roll numbers within the import file itself
    const rollNumbers = validatedRows.map(r => r.roll_number);
    const duplicates = rollNumbers.filter((r, i) => rollNumbers.indexOf(r) !== i);
    if (duplicates.length > 0) {
      errors.push({ row: 0, field: 'roll_number', error: `Duplicate roll numbers in import file: ${[...new Set(duplicates)].join(', ')}` });
    }

    // Check for existing roll numbers in DB
    if (rollNumbers.length > 0) {
      const { rows: existingRolls } = await pool.query(
        `SELECT roll_number FROM students WHERE roll_number = ANY($1)`,
        [rollNumbers],
      );
      existingRolls.forEach((r: any) => {
        errors.push({ row: 0, field: 'roll_number', error: `Roll number ${r.roll_number} already exists in the system.` });
      });
    }

    // ── If ANY errors → return error report Excel, insert NOTHING ──
    if (errors.length > 0) {
      const errorReport = await this.buildErrorReportExcel(errors);
      return { success: false, errorReport, errorCount: errors.length };
    }

    // ── All valid → insert ALL in a single transaction ──
    const client = await pool.connect();
    let importedCount = 0;

    try {
      await client.query('BEGIN');

      const { rows: roleRows } = await client.query(
        `SELECT role_id FROM roles WHERE role_name = 'STUDENT' LIMIT 1`,
      );
      const studentRoleId = roleRows[0]?.role_id;

      for (const row of validatedRows) {
        const placeholderUsername = `${row.roll_number.toLowerCase()}@pending`;
        const placeholderHash = '$2b$12$placeholder_pending_credential_generation';

        const { rows: userRows } = await client.query(
          `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id,
                              mobile_number, must_change_password, is_active)
           VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, TRUE, TRUE)
           RETURNING user_id`,
          [placeholderUsername, row.email, placeholderHash, row.first_name, row.last_name,
           studentRoleId, row.mobile_number],
        );

        await client.query(
          `INSERT INTO students (user_id, roll_number, batch_id, admission_date, date_of_birth,
                                 gender, parent_guardian_name, parent_contact_number, is_active, admission_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'pending')`,
          [userRows[0].user_id, row.roll_number, row.batch_id, row.admission_date, row.date_of_birth,
           row.gender, row.parent_guardian_name, row.parent_contact_number],
        );

        importedCount++;
      }

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, details)
         VALUES ($1, 'BULK_IMPORT', 'student', $2)`,
        [actingUserId, JSON.stringify({ imported: importedCount, by: actingUserId })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Bulk import complete', imported: importedCount, by: actingUserId });
      return { success: true, imported: importedCount, skipped: 0 };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Returns a downloadable Excel template for bulk import.
   * Includes headers, a sample row, and a notes sheet.
   */
  async getBulkImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // ── Sheet 1: Template ──
    const sheet = workbook.addWorksheet('Student Import Template');

    const headers = [
      { header: 'roll_number', key: 'roll_number', width: 15 },
      { header: 'first_name', key: 'first_name', width: 15 },
      { header: 'last_name', key: 'last_name', width: 15 },
      { header: 'email', key: 'email', width: 25 },
      { header: 'mobile_number', key: 'mobile_number', width: 15 },
      { header: 'date_of_birth', key: 'date_of_birth', width: 15 },
      { header: 'gender', key: 'gender', width: 12 },
      { header: 'batch_name', key: 'batch_name', width: 20 },
      { header: 'department_code', key: 'department_code', width: 15 },
      { header: 'parent_guardian_name', key: 'parent_guardian_name', width: 20 },
      { header: 'parent_contact_number', key: 'parent_contact_number', width: 18 },
      { header: 'admission_date', key: 'admission_date', width: 15 },
      { header: 'category', key: 'category', width: 12 },
    ];

    sheet.columns = headers;

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
      cell.alignment = { horizontal: 'center' };
    });
    headerRow.height = 20;

    // Sample row
    sheet.addRow({
      roll_number: 'BCA240001',
      first_name: 'Rahul',
      last_name: 'Sharma',
      email: 'rahul.sharma@example.com',
      mobile_number: '9876543210',
      date_of_birth: '2005-03-15',
      gender: 'Male',
      batch_name: 'BCA-2024-1-A',
      department_code: 'BCA',
      parent_guardian_name: 'Rajesh Sharma',
      parent_contact_number: '9876543211',
      admission_date: '2024-08-01',
      category: 'General',
    });

    // ── Sheet 2: Notes ──
    const notes = workbook.addWorksheet('Instructions');
    notes.getCell('A1').value = 'UniCampus ERP — Bulk Student Import Instructions';
    notes.getCell('A1').font = { bold: true, size: 14 };
    [
      ['Field', 'Format', 'Required', 'Notes'],
      ['roll_number', 'Text', 'Yes', 'Must be unique. Max 20 chars.'],
      ['first_name', 'Text', 'Yes', 'Min 2, Max 100 chars.'],
      ['last_name', 'Text', 'Yes', 'Min 1, Max 100 chars.'],
      ['email', 'Email', 'Yes', 'Must be a valid email. Used for credential delivery.'],
      ['mobile_number', '10 digits', 'Yes', 'Indian mobile (6-9 start). Used for OTP and credential SMS.'],
      ['date_of_birth', 'YYYY-MM-DD', 'Yes', 'Format: 2005-03-15'],
      ['gender', 'Enum', 'Yes', 'One of: Male, Female, Other, Prefer not to say'],
      ['batch_name', 'Text', 'Yes', 'Must exactly match an active batch in the system.'],
      ['department_code', 'Text', 'Yes', 'Must exactly match a department code (e.g. BCA, CS, MATHS).'],
      ['parent_guardian_name', 'Text', 'No', 'Max 100 chars.'],
      ['parent_contact_number', '10 digits', 'No', 'Indian mobile format.'],
      ['admission_date', 'YYYY-MM-DD', 'Yes', 'Date of admission.'],
      ['category', 'Enum', 'No', 'One of: General, OBC, SC, ST, EWS'],
    ].forEach((row, i) => {
      const r = notes.getRow(i + 3);
      row.forEach((val, j) => { r.getCell(j + 1).value = val; });
      if (i === 0) {
        r.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; });
      }
    });
    notes.getColumn(1).width = 22;
    notes.getColumn(2).width = 15;
    notes.getColumn(3).width = 10;
    notes.getColumn(4).width = 50;

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  /**
   * Returns the onboarding status dashboard counts.
   */
  async getOnboardingStatus(filters: { batch_id?: number; department_id?: number }): Promise<OnboardingCounts> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.batch_id) { conditions.push(`s.batch_id = $${idx++}`); params.push(filters.batch_id); }
    if (filters.department_id) { conditions.push(`b.department_id = $${idx++}`); params.push(filters.department_id); }
    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE s.credential_sent_at IS NULL)                                          AS not_generated,
         COUNT(*) FILTER (WHERE s.credential_sent_at IS NOT NULL AND s.first_login_at IS NULL)         AS sent_not_logged,
         COUNT(*) FILTER (WHERE s.first_login_at IS NOT NULL AND u.must_change_password = TRUE)        AS logged_in,
         COUNT(*) FILTER (WHERE u.must_change_password = FALSE)                                        AS fully_onboarded,
         COUNT(*)                                                                                       AS total
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       JOIN batches b ON s.batch_id = b.batch_id
       WHERE s.is_active = TRUE ${where}`,
      params,
    );

    return {
      not_generated:   parseInt(rows[0].not_generated, 10),
      sent_not_logged: parseInt(rows[0].sent_not_logged, 10),
      logged_in:       parseInt(rows[0].logged_in, 10),
      fully_onboarded: parseInt(rows[0].fully_onboarded, 10),
      total:           parseInt(rows[0].total, 10),
    };
  }

  /** Builds the error report Excel for bulk import failures */
  private async buildErrorReportExcel(errors: BulkImportError[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    // Sheet 1: Metadata
    const meta = wb.addWorksheet('Report Info');
    meta.getCell('A1').value = 'UniCampus ERP — Bulk Import Error Report';
    meta.getCell('A1').font = { bold: true, size: 13 };
    meta.getCell('A3').value = 'Generated At:';  meta.getCell('B3').value = new Date().toISOString();
    meta.getCell('A4').value = 'Total Errors:';  meta.getCell('B4').value = errors.length;
    meta.getCell('A5').value = 'Action Required:'; meta.getCell('B5').value = 'Fix all errors in the import file and re-upload. No records were created.';
    meta.getCell('A5').font = { bold: true, color: { argb: 'FFE11D48' } };

    // Sheet 2: Error details
    const errSheet = wb.addWorksheet('Errors');
    errSheet.columns = [
      { header: 'Row Number', key: 'row', width: 12 },
      { header: 'Field', key: 'field', width: 22 },
      { header: 'Error Description', key: 'error', width: 55 },
    ];
    const hRow = errSheet.getRow(1);
    hRow.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };
    });
    errors.forEach(e => errSheet.addRow(e));

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}

export const admissionService = new AdmissionService();
