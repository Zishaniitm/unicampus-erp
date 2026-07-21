import { Router } from 'express';
import { hostelController } from './hostel.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Hostel Routes — /api/v1/hostel/
 *
 * ALL AUTHENTICATED:
 *   GET  /categories       Categories with live availability
 *
 * STUDENT:
 *   GET  /my               Own registration + window status
 *   POST /apply            Apply for a category (window + capacity checked)
 *
 * STAFF / SUPER_ADMIN:
 *   GET  /pending          Pending applications queue
 *   POST /decide           Approve / reject (reason required on reject)
 *   POST /categories       Create a category
 *
 * SUPER_ADMIN:
 *   POST /windows          Set hostel/bus/semester registration windows
 */
const router = Router();
router.use(requireAuth);

const STAFF = ['STAFF', 'SUPER_ADMIN'];

router.get('/categories', hostelController.listCategories.bind(hostelController));

router.get('/my',
  requireRole(['STUDENT', 'SUPER_ADMIN']),
  hostelController.getMy.bind(hostelController));

router.post('/apply',
  requireRole(['STUDENT']),
  hostelController.apply.bind(hostelController));

router.get('/pending',
  requireRole(STAFF),
  hostelController.listPending.bind(hostelController));

router.post('/decide',
  requireRole(STAFF),
  hostelController.decide.bind(hostelController));

router.post('/categories',
  requireRole(STAFF),
  hostelController.createCategory.bind(hostelController));

router.post('/windows',
  requireRole(['SUPER_ADMIN']),
  hostelController.setWindow.bind(hostelController));

export default router;
