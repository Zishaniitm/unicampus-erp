import { z } from 'zod';

/** Schema for a single row in the bulk import Excel */
export const BulkImportRowSchema = z.object({
  roll_number:            z.string().min(3).max(20),
  first_name:             z.string().min(2).max(100),
  last_name:              z.string().min(1).max(100),
  email:                  z.string().email('Invalid email'),
  mobile_number:          z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  date_of_birth:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  gender:                 z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  batch_name:             z.string().min(2),   // resolved to batch_id during validation
  department_code:        z.string().min(2),   // resolved to department_id
  parent_guardian_name:   z.string().max(100).optional(),
  parent_contact_number:  z.string().regex(/^[6-9]\d{9}$/).optional(),
  admission_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category:               z.enum(['General', 'OBC', 'SC', 'ST', 'EWS']).optional(),
});

export const GenerateCredentialsSchema = z.object({
  student_ids: z.array(z.number().int().positive()).min(1).max(500),
});

export const ResendCredentialsSchema = z.object({
  student_id: z.number().int().positive(),
});

export type BulkImportRow     = z.infer<typeof BulkImportRowSchema>;
export type GenerateCredInput = z.infer<typeof GenerateCredentialsSchema>;
