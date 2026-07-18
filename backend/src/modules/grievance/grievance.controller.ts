import { Request, Response, NextFunction } from 'express';
import { grievanceService } from './grievance.service';
import {
  SubmitGrievanceSchema,
  UpdateGrievanceStatusSchema,
  GrievanceListQuerySchema,
} from './grievance.types';

export class GrievanceController {

  /** POST /api/v1/grievances — student submits a ticket */
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const input  = SubmitGrievanceSchema.parse(req.body);
      const result = await grievanceService.submitGrievance(input, req.user!.user_id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/grievances/my — student's own tickets */
  async listMy(req: Request, res: Response, next: NextFunction) {
    try {
      const query  = GrievanceListQuerySchema.parse(req.query);
      const result = await grievanceService.listMyGrievances(req.user!.user_id, query);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/grievances/assigned — officer's queue */
  async listAssigned(req: Request, res: Response, next: NextFunction) {
    try {
      const query  = GrievanceListQuerySchema.parse(req.query);
      const result = await grievanceService.listAssignedGrievances(req.user!.role, query);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/grievances/:id — ticket detail + timeline */
  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'Invalid grievance ID.' } });
        return;
      }
      const data = await grievanceService.getGrievance(id, req.user!.user_id, req.user!.role);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** PATCH /api/v1/grievances/:id/status — officer updates status */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'Invalid grievance ID.' } });
        return;
      }
      const input  = UpdateGrievanceStatusSchema.parse(req.body);
      const result = await grievanceService.updateStatus(id, input, req.user!.user_id, req.user!.role);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/grievances/escalate-overdue — admin triggers SLA sweep */
  async escalateOverdue(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await grievanceService.escalateOverdue(req.user!.user_id);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}

export const grievanceController = new GrievanceController();
