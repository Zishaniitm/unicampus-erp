import { Router } from 'express';
import { grievanceController } from './grievance.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Grievance Routes — /api/v1/grievances/
 *
 * POST  /                  Student: submit a grievance
 * GET   /my                Student: own tickets
 * GET   /assigned          Officer roles: queue routed to their role
 * GET   /:id               Ticket detail + timeline (owner or officer)
 * PATCH /:id/status        Officer: change status / resolve
 * POST  /escalate-overdue  Admin: sweep SLA-breached tickets → escalated
 */
const router = Router();
router.use(requireAuth);

const OFFICER_ROLES = ['HOD', 'ACCOUNT_OFFICER', 'LIBRARIAN', 'STAFF', 'PRINCIPAL', 'SUPER_ADMIN'];

router.post('/',
  requireRole(['STUDENT']),
  grievanceController.submit.bind(grievanceController),
);

router.get('/my',
  requireRole(['STUDENT']),
  grievanceController.listMy.bind(grievanceController),
);

router.get('/assigned',
  requireRole(OFFICER_ROLES),
  grievanceController.listAssigned.bind(grievanceController),
);

router.post('/escalate-overdue',
  requireRole(['SUPER_ADMIN', 'PRINCIPAL']),
  grievanceController.escalateOverdue.bind(grievanceController),
);

// Parameterised routes last so '/my', '/assigned' etc. are not swallowed by ':id'
router.get('/:id',
  grievanceController.getOne.bind(grievanceController),
);

router.patch('/:id/status',
  requireRole(OFFICER_ROLES),
  grievanceController.updateStatus.bind(grievanceController),
);

export default router;
