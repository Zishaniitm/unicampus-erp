import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Fee Routes — stub for Week 3.
 * Full implementation in Week 11-12 per SRS timeline.
 */
const router = Router();
router.use(requireAuth);

/** GET /api/v1/fee/my/balance — returns zero balance until Week 11 */
router.get('/my/balance', (_req, res) => {
  res.json({ success: true, data: { balance_due: 0, fine_accrued: 0, last_payment_date: null } });
});

export default router;
