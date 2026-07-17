import { Router } from 'express';
import { timetableController } from './timetable.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Timetable Routes — /api/v1/timetable/
 *
 * GET  /my                         Student weekly timetable
 * GET  /teacher/my                 Teacher weekly schedule
 * GET  /today                      Today's classes
 * GET  /dept?dept_id=              HOD: list dept timetables
 * GET  /resources?dept_id=         HOD: teachers/rooms/slots for building entries
 * POST /                           HOD: create new timetable
 * POST /entries                    HOD: add entry to timetable
 * PATCH /entries/:id/cancel        HOD: cancel a class
 */
const router = Router();
router.use(requireAuth);

router.get('/my',
  requireRole(['STUDENT', 'SUPER_ADMIN']),
  timetableController.getMyTimetable.bind(timetableController));

router.get('/teacher/my',
  requireRole(['TEACHER', 'HOD', 'SUPER_ADMIN']),
  timetableController.getTeacherTimetable.bind(timetableController));

router.get('/today',
  requireRole(['STUDENT', 'TEACHER', 'HOD', 'SUPER_ADMIN']),
  timetableController.getTodayClasses.bind(timetableController));

router.get('/dept',
  requireRole(['HOD', 'SUPER_ADMIN', 'PRINCIPAL']),
  timetableController.getDeptTimetables.bind(timetableController));

router.get('/resources',
  requireRole(['HOD', 'SUPER_ADMIN']),
  timetableController.getResources.bind(timetableController));

router.post('/',
  requireRole(['HOD', 'SUPER_ADMIN']),
  timetableController.createTimetable.bind(timetableController));

router.post('/entries',
  requireRole(['HOD', 'SUPER_ADMIN']),
  timetableController.createEntry.bind(timetableController));

router.patch('/entries/:id/cancel',
  requireRole(['HOD', 'SUPER_ADMIN']),
  timetableController.cancelEntry.bind(timetableController));

export default router;
