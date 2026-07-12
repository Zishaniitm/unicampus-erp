import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Attendance Routes — stub for Week 3.
 * Full implementation in Week 4 per SRS timeline.
 */
const router = Router();
router.use(requireAuth);

/** GET /api/v1/attendance/my/summary — returns empty until Week 4 */
router.get('/my/summary', (_req, res) => {
  res.json({ success: true, data: [] });
});

export default router;
