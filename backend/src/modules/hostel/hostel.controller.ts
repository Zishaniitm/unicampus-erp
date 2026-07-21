import { Request, Response, NextFunction } from 'express';
import { hostelService } from './hostel.service';
import {
  CreateHostelCategorySchema, ApplyHostelSchema,
  DecideRegistrationSchema, SetWindowSchema,
} from './hostel.types';

export class HostelController {

  /** GET /api/v1/hostel/categories — categories with availability (all auth) */
  async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await hostelService.listCategories();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/hostel/categories — staff creates a category */
  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateHostelCategorySchema.parse(req.body);
      const data  = await hostelService.createCategory(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/hostel/apply — student applies */
  async apply(req: Request, res: Response, next: NextFunction) {
    try {
      const input = ApplyHostelSchema.parse(req.body);
      const data  = await hostelService.apply(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/hostel/my — student's registration + window info */
  async getMy(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await hostelService.getMyRegistration(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/hostel/pending — staff queue */
  async listPending(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await hostelService.listPending();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/hostel/decide — staff approves/rejects */
  async decide(req: Request, res: Response, next: NextFunction) {
    try {
      const input = DecideRegistrationSchema.parse(req.body);
      const data  = await hostelService.decide(input, req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/hostel/windows — admin sets a registration window (any type) */
  async setWindow(req: Request, res: Response, next: NextFunction) {
    try {
      const input = SetWindowSchema.parse(req.body);
      const data  = await hostelService.setWindow(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const hostelController = new HostelController();
