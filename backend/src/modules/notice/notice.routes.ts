import { Router } from 'express';
import { noticeController } from './notice.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);

const POSTER_ROLES = ['SUPER_ADMIN', 'PRINCIPAL', 'HOD', 'STAFF'];

/** GET  /api/v1/notices — all authenticated users can view */
router.get('/',
  noticeController.list.bind(noticeController),
);

/** GET  /api/v1/notices/my-posted — poster's management list (before ':id' routes) */
router.get('/my-posted',
  requireRole(POSTER_ROLES),
  noticeController.listMyPosted.bind(noticeController),
);

/** POST /api/v1/notices — only staff/admin can post */
router.post('/',
  requireRole(POSTER_ROLES),
  noticeController.create.bind(noticeController),
);

/** POST /api/v1/notices/:id/read — mark as read (any authenticated user) */
router.post('/:id/read',
  noticeController.markRead.bind(noticeController),
);

/** DELETE /api/v1/notices/:id — poster/admin takes a notice down */
router.delete('/:id',
  requireRole(POSTER_ROLES),
  noticeController.deactivate.bind(noticeController),
);

export default router;
