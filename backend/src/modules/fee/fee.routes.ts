import { Router } from 'express';
import { feeController } from './fee.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Fee Routes — /api/v1/fee/
 *
 * PUBLIC (signature-verified, no JWT):
 *   POST /webhook                        Razorpay payment webhook
 *
 * STUDENT:
 *   GET  /my/balance                     Own balance breakdown
 *   GET  /my/ledger                      Own ledger lines + balance
 *   GET  /my/transactions                Own payment history
 *   POST /pay/order                      Initiate an online payment
 *
 * ACCOUNT_OFFICER / SUPER_ADMIN / PRINCIPAL:
 *   GET  /heads                          List fee heads
 *   POST /heads                          Create a fee head
 *   POST /assignments                    Assign a head to a batch (posts debits)
 *   POST /concessions                    Grant a concession
 *   POST /offline-payment                Record a cash/cheque/DD payment
 *   GET  /students/:studentId/ledger     View any student's ledger
 *
 * Roles: PRINCIPAL is read-capable per SRS but fee CRUD is Account Officer.
 * We allow PRINCIPAL + SUPER_ADMIN alongside ACCOUNT_OFFICER for management ops
 * (Principal has read-all + oversight; Super Admin has everything).
 */
const router = Router();

const OFFICER_ROLES = ['ACCOUNT_OFFICER', 'SUPER_ADMIN', 'PRINCIPAL'];

// ── Public webhook (MUST come before requireAuth) ─────────────
router.post('/webhook', feeController.webhook.bind(feeController));

// ── Everything below requires authentication ──────────────────
router.use(requireAuth);

// Student self-service
router.get('/my/balance',
  requireRole(['STUDENT']),
  feeController.getMyBalance.bind(feeController));

router.get('/my/ledger',
  requireRole(['STUDENT']),
  feeController.getMyLedger.bind(feeController));

router.get('/my/transactions',
  requireRole(['STUDENT']),
  feeController.getMyTransactions.bind(feeController));

router.post('/pay/order',
  requireRole(['STUDENT']),
  feeController.createOrder.bind(feeController));

// Officer management
router.get('/heads',
  requireRole(OFFICER_ROLES),
  feeController.listFeeHeads.bind(feeController));

router.post('/heads',
  requireRole(['ACCOUNT_OFFICER', 'SUPER_ADMIN']),
  feeController.createFeeHead.bind(feeController));

router.post('/assignments',
  requireRole(['ACCOUNT_OFFICER', 'SUPER_ADMIN']),
  feeController.createAssignment.bind(feeController));

router.post('/concessions',
  requireRole(['ACCOUNT_OFFICER', 'SUPER_ADMIN']),
  feeController.grantConcession.bind(feeController));

router.post('/offline-payment',
  requireRole(['ACCOUNT_OFFICER', 'SUPER_ADMIN']),
  feeController.recordOfflinePayment.bind(feeController));

router.get('/students/:studentId/ledger',
  requireRole(OFFICER_ROLES),
  feeController.getStudentLedger.bind(feeController));

export default router;
