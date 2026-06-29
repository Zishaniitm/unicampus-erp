import { Router } from 'express';
import multer from 'multer';
import { admissionController } from './admission.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are accepted for bulk import.'));
    }
  },
});

/**
 * Admission Routes — all under /api/v1/admission/
 * All routes restricted to ADMISSION_STAFF and SUPER_ADMIN only.
 *
 * GET  /import/template            Download the bulk import Excel template
 * POST /import                     Upload and process bulk student import
 * POST /credentials/generate       Generate credentials for confirmed students
 * GET  /onboarding-status          Dashboard counts by onboarding stage
 * GET  /onboarding-status/drill-down?status=not_generated  Student list by stage
 */
const router = Router();

router.use(requireAuth);
router.use(requireRole(['ADMISSION_STAFF', 'SUPER_ADMIN']));

router.get('/import/template', admissionController.getTemplate.bind(admissionController));
router.post('/import', upload.single('file'), admissionController.bulkImport.bind(admissionController));
router.post('/credentials/generate', admissionController.generateCredentials.bind(admissionController));
router.get('/onboarding-status', admissionController.getOnboardingStatus.bind(admissionController));
router.get('/onboarding-status/drill-down', admissionController.getDrillDown.bind(admissionController));

export default router;
