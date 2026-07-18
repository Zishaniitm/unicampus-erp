import { Request, Response, NextFunction } from 'express';
import { timetableService } from './timetable.service';
import { z } from 'zod';

const CreateEntrySchema = z.object({
  timetable_id:   z.number().int().positive(),
  day_of_week:    z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']),
  time_slot_id:   z.number().int().positive(),
  batch_course_id: z.number().int().positive(),
  classroom_id:   z.number().int().positive(),
  teacher_id:     z.number().int().positive(),
});

const CancelEntrySchema = z.object({
  reason: z.string().min(5, 'Cancellation reason required (min 5 chars)'),
});

const CreateTimetableSchema = z.object({
  batch_id:       z.number().int().positive(),
  academic_year:  z.string().regex(/^\d{4}-\d{4}$/),
  semester:       z.number().int().min(1).max(8),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export class TimetableController {
  async getMyTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await timetableService.getStudentTimetable(req.user!.user_id) });
    } catch (err) { next(err); }
  }

  async getTeacherTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await timetableService.getTeacherTimetable(req.user!.user_id) });
    } catch (err) { next(err); }
  }

  async getTodayClasses(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await timetableService.getTodayClasses(req.user!.user_id, req.user!.role) });
    } catch (err) { next(err); }
  }

  /** HOD: GET /api/v1/timetable/dept — list timetables for dept */
  async getDeptTimetables(req: Request, res: Response, next: NextFunction) {
    try {
      const deptId = parseInt(req.query.dept_id as string, 10);
      if (isNaN(deptId)) { res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'dept_id required' } }); return; }
      res.json({ success: true, data: await timetableService.getDeptTimetables(deptId) });
    } catch (err) { next(err); }
  }

  /** HOD: POST /api/v1/timetable — create timetable */
  async createTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const input  = CreateTimetableSchema.parse(req.body);
      const result = await timetableService.createTimetable(input, req.user!.user_id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /** HOD: POST /api/v1/timetable/entries — add entry */
  async createEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const input  = CreateEntrySchema.parse(req.body);
      const result = await timetableService.createEntry(input, req.user!.user_id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /** HOD: PATCH /api/v1/timetable/entries/:id/cancel */
  async cancelEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const entryId = parseInt(req.params.id, 10);
      const { reason } = CancelEntrySchema.parse(req.body);
      await timetableService.cancelEntry(entryId, reason, req.user!.user_id);
      res.json({ success: true, data: { message: 'Class cancelled.' } });
    } catch (err) { next(err); }
  }

  /** HOD: GET /api/v1/timetable/resources?dept_id= */
  async getResources(req: Request, res: Response, next: NextFunction) {
    try {
      const deptId = parseInt(req.query.dept_id as string, 10);
      if (isNaN(deptId)) { res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'dept_id required' } }); return; }
      res.json({ success: true, data: await timetableService.getResources(deptId) });
    } catch (err) { next(err); }
  }
}

export const timetableController = new TimetableController();
