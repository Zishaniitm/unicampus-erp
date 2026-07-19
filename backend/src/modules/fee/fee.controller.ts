import { Request, Response, NextFunction } from 'express';
import { feeService } from './fee.service';
import {
  CreateFeeHeadSchema,
  CreateFeeAssignmentSchema,
  GrantConcessionSchema,
  RecordOfflinePaymentSchema,
  CreatePaymentOrderSchema,
} from './fee.types';

export class FeeController {

  // ── Student ────────────────────────────────────────────────

  /** GET /api/v1/fee/my/balance */
  async getMyBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await feeService.getMyBalance(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/fee/my/ledger */
  async getMyLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await feeService.getMyLedger(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/fee/my/transactions */
  async getMyTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await feeService.getMyTransactions(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/fee/pay/order — student initiates an online payment */
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreatePaymentOrderSchema.parse(req.body);
      const data  = await feeService.createPaymentOrder(req.user!.user_id, input.amount_paise);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Razorpay webhook (PUBLIC — no auth) ────────────────────

  /** POST /api/v1/fee/webhook — Razorpay calls this. Signature-verified. */
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.header('x-razorpay-signature');
      // rawBody is captured by the express.json verify hook in app.ts
      const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
      const result  = await feeService.handleWebhook(rawBody, signature);
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  // ── Account Officer ────────────────────────────────────────

  /** GET /api/v1/fee/heads */
  async listFeeHeads(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await feeService.listFeeHeads();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/fee/heads */
  async createFeeHead(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateFeeHeadSchema.parse(req.body);
      const data  = await feeService.createFeeHead(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/fee/assignments */
  async createAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateFeeAssignmentSchema.parse(req.body);
      const data  = await feeService.createAssignment(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/fee/concessions */
  async grantConcession(req: Request, res: Response, next: NextFunction) {
    try {
      const input = GrantConcessionSchema.parse(req.body);
      const data  = await feeService.grantConcession(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/fee/offline-payment */
  async recordOfflinePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const input = RecordOfflinePaymentSchema.parse(req.body);
      const data  = await feeService.recordOfflinePayment(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/fee/students/:studentId/ledger — officer views a student's ledger */
  async getStudentLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = parseInt(req.params.studentId, 10);
      if (isNaN(studentId)) {
        res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'Invalid student ID.' } });
        return;
      }
      const data = await feeService.getStudentLedgerForOfficer(studentId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const feeController = new FeeController();
