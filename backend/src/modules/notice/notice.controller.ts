import { Request, Response, NextFunction } from 'express';
import { noticeService } from './notice.service';
import { z } from 'zod';

const CreateNoticeSchema = z.object({
  title:        z.string().min(3).max(200),
  body:         z.string().min(10),
  is_critical:  z.boolean().optional().default(false),
  target_role:  z.string().optional(),
  target_dept:  z.number().optional(),
  target_batch: z.number().optional(),
  visible_from: z.string().optional(),
  visible_to:   z.string().optional(),
});

export class NoticeController {
  /** GET /api/v1/notices */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page     = parseInt(req.query.page as string ?? '1', 10);
      const per_page = parseInt(req.query.per_page as string ?? '10', 10);
      const result   = await noticeService.listNotices(req.user!.user_id, req.user!.role, { page, per_page });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/notices */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input  = CreateNoticeSchema.parse(req.body);
      const result = await noticeService.createNotice(input, req.user!.user_id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}

export const noticeController = new NoticeController();
