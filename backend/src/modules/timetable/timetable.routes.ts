import { Router } from 'express';
import { timetableController } from './timetable.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Timetable Routes — all under /api/v1/timetable/
 *
 * GET /my              Student's weekly timetable
 * GET /teacher/my      Teacher's weekly schedule
 * GET /today           Today's classes for current user
 */
const router = Router();
router.use(requireAuth);

router.get('/my',
  requireRole(['STUDENT', 'SUPER_ADMIN']),
  timetableController.getMyTimetable.bind(timetableController),
);

router.get('/teacher/my',
  requireRole(['TEACHER', 'HOD', 'SUPER_ADMIN']),
  timetableController.getTeacherTimetable.bind(timetableController),
);

router.get('/today',
  requireRole(['STUDENT', 'TEACHER', 'HOD', 'SUPER_ADMIN']),
  timetableController.getTodayClasses.bind(timetableController),
);

export default router;
