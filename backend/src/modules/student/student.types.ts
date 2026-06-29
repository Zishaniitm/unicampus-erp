import { z } from 'zod';

export const CreateStudentSchema = z.object({
  // User account fields
  first_name:             z.string().min(2).max(100),
  last_name:              z.string().min(1).max(100),
  email:                  z.string().email('Invalid email address'),
  mobile_number:          z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),

  // Student profile fields
  roll_number:            z.string().min(3).max(20),
  batch_id:               z.number().int().positive(),
  date_of_birth:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  gender:                 z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  address:                z.string().max(500).optional(),
  contact_number:         z.string().regex(/^[6-9]\d{9}$/).optional(),
  parent_guardian_name:   z.string().max(100).optional(),
  parent_contact_number:  z.string().regex(/^[6-9]\d{9}$/).optional(),
  admission_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  admission_type:         z.enum(['direct', 'counselling']).optional(),
  category:               z.enum(['General', 'OBC', 'SC', 'ST', 'EWS']).optional(),
});

export const UpdateStudentSchema = z.object({
  // Students can only update these fields themselves
  address:               z.string().max(500).optional(),
  contact_number:        z.string().regex(/^[6-9]\d{9}$/).optional(),
  parent_guardian_name:  z.string().max(100).optional(),
  parent_contact_number: z.string().regex(/^[6-9]\d{9}$/).optional(),
});

export const AdminUpdateStudentSchema = z.object({
  // Admin/Staff can update any field
  first_name:            z.string().min(2).max(100).optional(),
  last_name:             z.string().min(1).max(100).optional(),
  email:                 z.string().email().optional(),
  mobile_number:         z.string().regex(/^[6-9]\d{9}$/).optional(),
  batch_id:              z.number().int().positive().optional(),
  admission_status:      z.enum(['pending', 'confirmed', 'rejected', 'withdrawn']).optional(),
  is_active:             z.boolean().optional(),
});

export const AcademicHoldSchema = z.object({
  hold: z.boolean(),
  reason: z.string().min(10, 'Provide a reason of at least 10 characters').when(
    (val, ctx) => {
      if (ctx.parent?.hold === true && !val) {
        ctx.addIssue({ code: 'custom', message: 'Reason is required when placing a hold' });
      }
    }
  ).optional(),
});

// Safer version without .when() for Zod v3
export const SetAcademicHoldSchema = z.object({
  hold: z.boolean(),
  reason: z.string().min(10).optional(),
}).refine(
  (data) => !data.hold || (data.hold && data.reason && data.reason.length >= 10),
  { message: 'A reason of at least 10 characters is required when placing a hold', path: ['reason'] }
);

export const StudentListQuerySchema = z.object({
  page:         z.coerce.number().int().positive().default(1),
  per_page:     z.coerce.number().int().min(1).max(100).default(20),
  sort:         z.enum(['roll_number', 'first_name', 'created_at']).default('roll_number'),
  order:        z.enum(['asc', 'desc']).default('asc'),
  search:       z.string().max(100).optional(),
  batch_id:     z.coerce.number().int().positive().optional(),
  department_id: z.coerce.number().int().positive().optional(),
  is_active:    z.coerce.boolean().optional(),
  admission_status: z.enum(['pending', 'confirmed', 'rejected', 'withdrawn']).optional(),
});

export type CreateStudentInput   = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput   = z.infer<typeof UpdateStudentSchema>;
export type AdminUpdateStudentInput = z.infer<typeof AdminUpdateStudentSchema>;
export type StudentListQuery     = z.infer<typeof StudentListQuerySchema>;
export type SetAcademicHoldInput = z.infer<typeof SetAcademicHoldSchema>;
