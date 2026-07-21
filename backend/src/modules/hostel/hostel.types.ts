import { z } from 'zod';

export const CreateHostelCategorySchema = z.object({
  category_name:  z.string().min(3).max(80),
  description:    z.string().max(1000).optional(),
  gender:         z.enum(['Male', 'Female', 'Any']).optional().default('Any'),
  total_capacity: z.number().int().min(0).max(10000),
  fee_per_semester_paise: z.number().int().min(0),
});

export const ApplyHostelSchema = z.object({
  category_id: z.number().int().positive(),
  remarks:     z.string().max(500).optional(),
});

export const DecideRegistrationSchema = z.object({
  // BIGSERIAL ids arrive as strings from the pg driver — coerce
  registration_id: z.coerce.number().int().positive(),
  decision:        z.enum(['approved', 'rejected']),
  remarks:         z.string().max(500).optional(),
}).refine(d => d.decision !== 'rejected' || (d.remarks && d.remarks.trim().length >= 5), {
  message: 'A reason (5+ characters) is required when rejecting',
  path: ['remarks'],
});

export const SetWindowSchema = z.object({
  window_type:   z.enum(['hostel', 'bus', 'semester']),
  academic_year: z.string().regex(/^\d{4}-\d{4}$/),
  opens_at:      z.string().datetime({ offset: true }),
  closes_at:     z.string().datetime({ offset: true }),
}).refine(w => new Date(w.closes_at) > new Date(w.opens_at), {
  message: 'closes_at must be after opens_at',
  path: ['closes_at'],
});

export type CreateHostelCategoryInput = z.infer<typeof CreateHostelCategorySchema>;
export type ApplyHostelInput          = z.infer<typeof ApplyHostelSchema>;
export type DecideRegistrationInput   = z.infer<typeof DecideRegistrationSchema>;
export type SetWindowInput            = z.infer<typeof SetWindowSchema>;

/** Current academic year in IST, e.g. "2026-2027" (July–June session) */
export function currentAcademicYear(now: Date = new Date()): string {
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = ist.getFullYear();
  // Academic year starts in July
  return ist.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
