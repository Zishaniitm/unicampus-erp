import { z } from 'zod';

/** Category → responsible role routing (FR-GRIEV-002) */
export const CATEGORY_ROUTING: Record<string, string> = {
  academic:       'HOD',
  financial:      'ACCOUNT_OFFICER',
  administrative: 'SUPER_ADMIN',
  hostel:         'STAFF',
  library:        'LIBRARIAN',
  other:          'SUPER_ADMIN',
};

export const GRIEVANCE_CATEGORIES = ['academic', 'financial', 'administrative', 'hostel', 'library', 'other'] as const;
export const GRIEVANCE_STATUSES   = ['open', 'in_review', 'resolved', 'escalated'] as const;

export const SubmitGrievanceSchema = z.object({
  category:    z.enum(GRIEVANCE_CATEGORIES),
  subject:     z.string().min(5, 'Subject must be at least 5 characters').max(200),
  description: z.string().min(20, 'Please describe your grievance in at least 20 characters').max(1000),
});

export const UpdateGrievanceStatusSchema = z.object({
  status:           z.enum(['in_review', 'resolved', 'escalated']),
  comment:          z.string().max(1000).optional(),
  resolution_notes: z.string().min(10).max(2000).optional(),
}).refine(
  (data) => data.status !== 'resolved' || !!data.resolution_notes,
  { message: 'Resolution notes are required when resolving a grievance', path: ['resolution_notes'] },
);

export const GrievanceListQuerySchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(50).default(10),
  status:   z.enum(GRIEVANCE_STATUSES).optional(),
  category: z.enum(GRIEVANCE_CATEGORIES).optional(),
});

export type SubmitGrievanceInput       = z.infer<typeof SubmitGrievanceSchema>;
export type UpdateGrievanceStatusInput = z.infer<typeof UpdateGrievanceStatusSchema>;
export type GrievanceListQuery         = z.infer<typeof GrievanceListQuerySchema>;
