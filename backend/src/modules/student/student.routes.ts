import { Router } from 'express';
import { studentController } from './student.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/auth.middleware';

/**
 * Student Routes — all under /api/v1/students/
 *
 * GET  /                     List students (paginated, filtered)
 * GET  /:id                  Get student by ID
 * POST /                     Create student (staff/admin only)
 * PATCH /:id                 Update student
 * PATCH /:id/academic-hold   Set/remove academic hold (HOD/admin only)
 */
const router = Router();

// All student routes require authentication
router.use(requireAuth);

router.get('/',
  requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'HOD', 'TEACHER', 'STAFF', 'ACCOUNT_OFFICER', 'ADMISSION_STAFF', 'EXAM_CONTROLLER', 'LIBRARIAN']),
  studentController.list.bind(studentController),
);

router.get('/:id',
  // STUDENT role can access own record — service enforces ownership
  requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'HOD', 'TEACHER', 'STAFF', 'ACCOUNT_OFFICER', 'ADMISSION_STAFF', 'EXAM_CONTROLLER', 'LIBRARIAN', 'STUDENT']),
  studentController.getById.bind(studentController),
);

router.post('/',
  requireRole(['SUPER_ADMIN', 'STAFF', 'ADMISSION_STAFF']),
  studentController.create.bind(studentController),
);

router.patch('/:id',
  requireRole(['SUPER_ADMIN', 'STAFF', 'ADMISSION_STAFF', 'STUDENT']),
  studentController.update.bind(studentController),
);

router.patch('/:id/academic-hold',
  requireRole(['SUPER_ADMIN', 'HOD']),
  studentController.setAcademicHold.bind(studentController),
);

export default router;
