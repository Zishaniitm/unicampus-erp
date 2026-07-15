import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import {
  MarkAttendanceSchema,
  EditAttendanceSchema,
  AttendanceSummaryQuerySchema,
} from './attendance.types';

export class AttendanceController {

  /** GET /api/v1/attendance/my/summary — student's own attendance */
  async getMySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.getStudentSummary(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/attendance/roster/:entryId?date=YYYY-MM-DD — teacher gets class roster */
  async getRoster(req: Request, res: Response, next: NextFunction) {
    try {
      const entryId = parseInt(req.params.entryId, 10);
      const date    = (req.query.date as string) ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      if (isNaN(entryId)) {
        res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'Invalid entry ID.' } });
        return;
      }

      const data = await attendanceService.getClassRoster(entryId, date, req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/attendance/mark — teacher marks attendance for a class */
  async mark(req: Request, res: Response, next: NextFunction) {
    try {
      const input  = MarkAttendanceSchema.parse(req.body);
      const result = await attendanceService.markAttendance(input, req.user!.user_id, req.user!.role);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /** PATCH /api/v1/attendance/edit — edit a single attendance record */
  async edit(req: Request, res: Response, next: NextFunction) {
    try {
      const input = EditAttendanceSchema.parse(req.body);
      await attendanceService.editAttendance(input, req.user!.user_id, req.user!.role);
      res.json({ success: true, data: { message: 'Attendance updated.' } });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/attendance/batch/:batchId — HOD batch summary */
  async getBatchSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const batchId  = parseInt(req.params.batchId, 10);
      const fromDate = req.query.from_date as string | undefined;
      const toDate   = req.query.to_date   as string | undefined;
      const data     = await attendanceService.getBatchSummary(batchId, fromDate, toDate);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const attendanceController = new AttendanceController();
