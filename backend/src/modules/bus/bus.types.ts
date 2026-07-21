import { z } from 'zod';

export const CreateBusRouteSchema = z.object({
  route_name: z.string().min(3).max(100),
  stops:      z.array(z.string().min(1).max(100)).min(1).max(50),
  capacity:   z.number().int().min(0).max(500),
  fee_per_semester_paise: z.number().int().min(0),
});

export const ApplyBusSchema = z.object({
  route_id:  z.number().int().positive(),
  stop_name: z.string().min(1).max(100),
});

export type CreateBusRouteInput = z.infer<typeof CreateBusRouteSchema>;
export type ApplyBusInput       = z.infer<typeof ApplyBusSchema>;
