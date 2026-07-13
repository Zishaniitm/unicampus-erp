import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Attendance Routes — /api/v1/attendance/
 *
 * GET  /my/summary          Student: own subject-wise attendance
 * GET  /roster/:entryId     Teacher: class roster for marking
 * POST /mark                Teacher: submit attendance for a class
 * PATCH /edit               Teacher (24h) / HOD: edit a record
 * GET  /batch/:batchId      HOD/Principal: batch-wise summary
 */
const router = Router();
router.use(requireAuth);

router.get('/my/summary',
  requireRole(['STUDENT']),
  attendanceController.getMySummary.bind(attendanceController),
);

router.get('/roster/:entryId',
  requireRole(['TEACHER', 'HOD', 'SUPER_ADMIN']),
  attendanceController.getRoster.bind(attendanceController),
);

router.post('/mark',
  requireRole(['TEACHER', 'HOD', 'SUPER_ADMIN']),
  attendanceController.mark.bind(attendanceController),
);

router.patch('/edit',
  requireRole(['TEACHER', 'HOD', 'SUPER_ADMIN']),
  attendanceController.edit.bind(attendanceController),
);

router.get('/batch/:batchId',
  requireRole(['HOD', 'PRINCIPAL', 'SUPER_ADMIN']),
  attendanceController.getBatchSummary.bind(attendanceController),
);

export default router;
