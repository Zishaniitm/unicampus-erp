import { Router } from 'express';
import { noticeController } from './notice.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);

/** GET  /api/v1/notices — all authenticated users can view */
router.get('/',
  noticeController.list.bind(noticeController),
);

/** POST /api/v1/notices — only staff/admin can post */
router.post('/',
  requireRole(['SUPER_ADMIN', 'PRINCIPAL', 'HOD', 'STAFF']),
  noticeController.create.bind(noticeController),
);

export default router;
