import { Request, Response, NextFunction } from 'express';
import { timetableService } from './timetable.service';

export class TimetableController {
  /** GET /api/v1/timetable/my */
  async getMyTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await timetableService.getStudentTimetable(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/timetable/teacher/my */
  async getTeacherTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await timetableService.getTeacherTimetable(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/timetable/today */
  async getTodayClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await timetableService.getTodayClasses(req.user!.user_id, req.user!.role);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const timetableController = new TimetableController();
