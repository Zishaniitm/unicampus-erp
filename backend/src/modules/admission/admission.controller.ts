import { Request, Response, NextFunction } from 'express';
import { admissionService } from './admission.service';
import { GenerateCredentialsSchema, ResendCredentialsSchema } from './admission.types';

export class AdmissionController {
  /** GET /api/v1/admission/import/template */
  async getTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await admissionService.getBulkImportTemplate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="unicampus_student_import_template.xlsx"');
      res.send(buffer);
    } catch (err) { next(err); }
  }

  /** POST /api/v1/admission/import */
  async bulkImport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { code: 'ERR-ADM-003', message: 'No Excel file uploaded.' } });
        return;
      }
      const result = await admissionService.bulkImport(req.file.buffer, req.user!.user_id);

      if (!result.success) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="import_errors.xlsx"');
        res.setHeader('X-Import-Errors', result.errorCount.toString());
        res.status(422).send(result.errorReport);
        return;
      }

      res.status(201).json({
        success: true,
        data: { message: `${result.imported} students imported successfully.`, imported: result.imported },
      });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/admission/credentials/generate */
  async generateCredentials(req: Request, res: Response, next: NextFunction) {
    try {
      const input = GenerateCredentialsSchema.parse(req.body);
      const results = await admissionService.generateCredentials(input, req.user!.user_id);

      // NOTE: In production, results are dispatched via BullMQ SMS/email job, not returned to client
      // The SMS job reads mobile + email from DB. Plaintext passwords are in `results` array
      // ONLY for the duration of this request — they are never written to DB or logs
      res.status(200).json({
        success: true,
        data: {
          message: `Credentials generated for ${results.length} student(s). SMS/email dispatch queued.`,
          count: results.length,
          // In dev mode, return credentials for testing. NEVER in production.
          ...(process.env.NODE_ENV === 'development' && { credentials: results.map(r => ({ student_id: r.student_id, username: r.username })) }),
        },
      });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/admission/onboarding-status */
  async getOnboardingStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const batch_id = req.query.batch_id ? parseInt(req.query.batch_id as string, 10) : undefined;
      const department_id = req.query.department_id ? parseInt(req.query.department_id as string, 10) : undefined;
      const counts = await admissionService.getOnboardingStatus({ batch_id, department_id });
      res.json({ success: true, data: counts });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/admission/onboarding-status/drill-down */
  async getDrillDown(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string;
      const validStatuses = ['not_generated', 'sent_not_logged', 'logged_in', 'fully_onboarded'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'Invalid status filter.' } });
        return;
      }

      const statusConditions: Record<string, string> = {
        not_generated:   `s.credential_sent_at IS NULL`,
        sent_not_logged: `s.credential_sent_at IS NOT NULL AND s.first_login_at IS NULL`,
        logged_in:       `s.first_login_at IS NOT NULL AND u.must_change_password = TRUE`,
        fully_onboarded: `u.must_change_password = FALSE`,
      };

      const { rows } = await pool.query(
        `SELECT s.student_id, s.roll_number, u.first_name, u.last_name, u.email,
                s.credential_sent_at, s.first_login_at, u.must_change_password,
                b.batch_name, d.department_name
         FROM students s
         JOIN users u ON s.user_id = u.user_id
         JOIN batches b ON s.batch_id = b.batch_id
         JOIN departments d ON b.department_id = d.department_id
         WHERE s.is_active = TRUE AND ${statusConditions[status]}
         ORDER BY s.roll_number
         LIMIT 200`,
      );

      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  }
}

// Need to import pool for getDrillDown
import { pool } from '../../db/index';

export const admissionController = new AdmissionController();
