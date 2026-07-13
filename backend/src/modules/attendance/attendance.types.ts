import { z } from 'zod';

export const MarkAttendanceSchema = z.object({
  timetable_entry_id: z.number().int().positive(),
  att_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  records: z.array(z.object({
    student_id: z.number().int().positive(),
    status:     z.enum(['P', 'A', 'ML', 'DL']),
  })).min(1, 'At least one student record required'),
});

export const EditAttendanceSchema = z.object({
  att_id:      z.number().int().positive(),
  status:      z.enum(['P', 'A', 'ML', 'DL']),
  edit_reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export const AttendanceSummaryQuerySchema = z.object({
  student_id:  z.coerce.number().int().positive().optional(),
  batch_id:    z.coerce.number().int().positive().optional(),
  from_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type MarkAttendanceInput   = z.infer<typeof MarkAttendanceSchema>;
export type EditAttendanceInput   = z.infer<typeof EditAttendanceSchema>;
export type AttendanceSummaryQuery = z.infer<typeof AttendanceSummaryQuerySchema>;
