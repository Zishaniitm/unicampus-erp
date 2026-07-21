import { Router } from 'express';
import { busController } from './bus.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Bus Routes — /api/v1/bus/
 *
 * ALL AUTHENTICATED:
 *   GET  /routes         Routes with stops + availability
 *
 * STUDENT:
 *   GET  /my             Own registration + window status
 *   POST /apply          Apply for a route + stop
 *
 * STAFF / SUPER_ADMIN:
 *   GET  /pending        Pending applications
 *   POST /decide         Approve / reject
 *   POST /routes         Create a route
 */
const router = Router();
router.use(requireAuth);

const STAFF = ['STAFF', 'SUPER_ADMIN'];

router.get('/routes', busController.listRoutes.bind(busController));

router.get('/my',
  requireRole(['STUDENT', 'SUPER_ADMIN']),
  busController.getMy.bind(busController));

router.post('/apply',
  requireRole(['STUDENT']),
  busController.apply.bind(busController));

router.get('/pending',
  requireRole(STAFF),
  busController.listPending.bind(busController));

router.post('/decide',
  requireRole(STAFF),
  busController.decide.bind(busController));

router.post('/routes',
  requireRole(STAFF),
  busController.createRoute.bind(busController));

export default router;
