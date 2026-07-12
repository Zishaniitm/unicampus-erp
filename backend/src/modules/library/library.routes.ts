import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Library Routes — stub for Week 3.
 * Full implementation in Week 15-16 per SRS timeline.
 */
const router = Router();
router.use(requireAuth);

/** GET /api/v1/library/my/issued — returns empty until Week 15 */
router.get('/my/issued', (_req, res) => {
  res.json({ success: true, data: [] });
});

export default router;
