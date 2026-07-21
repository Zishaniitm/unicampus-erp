import { Request, Response, NextFunction } from 'express';
import { busService } from './bus.service';
import { CreateBusRouteSchema, ApplyBusSchema } from './bus.types';
import { DecideRegistrationSchema } from '../hostel/hostel.types';

export class BusController {

  /** GET /api/v1/bus/routes — routes with availability (all auth) */
  async listRoutes(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await busService.listRoutes();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/bus/routes — staff creates a route */
  async createRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateBusRouteSchema.parse(req.body);
      const data  = await busService.createRoute(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/bus/apply — student applies */
  async apply(req: Request, res: Response, next: NextFunction) {
    try {
      const input = ApplyBusSchema.parse(req.body);
      const data  = await busService.apply(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/bus/my — student's registration + window */
  async getMy(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await busService.getMyRegistration(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/bus/pending — staff queue */
  async listPending(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await busService.listPending();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/bus/decide — staff approves/rejects */
  async decide(req: Request, res: Response, next: NextFunction) {
    try {
      const input = DecideRegistrationSchema.parse(req.body);
      const data  = await busService.decide(input, req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const busController = new BusController();
