import { z } from 'zod';

// ── Constants ────────────────────────────────────────────────
export const FEE_METHODS = ['razorpay', 'cash', 'cheque', 'dd', 'neft', 'upi_offline'] as const;
export const OFFLINE_METHODS = ['cash', 'cheque', 'dd', 'neft', 'upi_offline'] as const;
export const TXN_STATUSES = ['CREATED', 'PENDING', 'SUCCESS', 'FAILED'] as const;
export const CONCESSION_TYPES = ['scholarship', 'sibling', 'staff_ward', 'merit', 'sports', 'other'] as const;

export type FeeMethod      = (typeof FEE_METHODS)[number];
export type TxnStatus      = (typeof TXN_STATUSES)[number];
export type ConcessionType = (typeof CONCESSION_TYPES)[number];

// ── Validation schemas ───────────────────────────────────────

/** Account Officer creates a fee head */
export const CreateFeeHeadSchema = z.object({
  head_code:     z.string().min(2).max(30).regex(/^[A-Z0-9_]+$/, 'Head code must be UPPERCASE letters, digits, underscore'),
  head_name:     z.string().min(3).max(100),
  description:   z.string().max(1000).optional(),
  is_refundable: z.boolean().optional().default(false),
});

/** Account Officer assigns a head to a batch with an amount + due date */
export const CreateFeeAssignmentSchema = z.object({
  fee_head_id:   z.number().int().positive(),
  batch_id:      z.number().int().positive(),
  academic_year: z.string().regex(/^\d{4}-\d{4}$/, 'Academic year must be YYYY-YYYY'),
  semester:      z.number().int().min(1).max(8),
  amount_paise:  z.number().int().min(0),
  due_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  late_fine_per_day_paise: z.number().int().min(0).optional().default(0),
});

/** Account Officer grants a concession to a student */
export const GrantConcessionSchema = z.object({
  student_id:      z.number().int().positive(),
  assignment_id:   z.number().int().positive(),
  concession_type: z.enum(CONCESSION_TYPES),
  amount_paise:    z.number().int().positive(),
  reason:          z.string().min(5).max(500),
});

/** Account Officer records an offline (cash/cheque/DD) payment */
export const RecordOfflinePaymentSchema = z.object({
  student_id:        z.number().int().positive(),
  amount_paise:      z.number().int().positive(),
  method:            z.enum(OFFLINE_METHODS),
  offline_reference: z.string().max(60).optional(),
  notes:             z.string().max(500).optional(),
});

/** Student initiates an online payment — server decides amount from balance */
export const CreatePaymentOrderSchema = z.object({
  amount_paise: z.number().int().positive(),
});

/** Razorpay webhook payload (only the fields we use) */
export const RazorpayWebhookSchema = z.object({
  event:   z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id:       z.string(),
        order_id: z.string(),
        amount:   z.number().int(),
        status:   z.string(),
      }),
    }).optional(),
  }),
});

export type CreateFeeHeadInput       = z.infer<typeof CreateFeeHeadSchema>;
export type CreateFeeAssignmentInput = z.infer<typeof CreateFeeAssignmentSchema>;
export type GrantConcessionInput     = z.infer<typeof GrantConcessionSchema>;
export type RecordOfflinePaymentInput = z.infer<typeof RecordOfflinePaymentSchema>;
export type CreatePaymentOrderInput  = z.infer<typeof CreatePaymentOrderSchema>;

// ── Pure balance calculation (SRS Section 9 — MUST be unit-tested) ──

export interface FeeAssignmentRow {
  assignment_id: number;
  amount_paise:  number;
  due_date:      string;   // YYYY-MM-DD
  late_fine_per_day_paise: number;
}

export interface ConcessionRow {
  assignment_id: number;
  amount_paise:  number;
}

export interface PaymentRow {
  amount_paise: number;
  status:       TxnStatus;
}

export interface FeeBalanceResult {
  gross_payable_paise: number;  // sum of all assigned amounts
  concession_paise:    number;  // total waived
  net_payable_paise:   number;  // gross - concession
  paid_paise:          number;  // sum of SUCCESS payments
  fine_paise:          number;  // accrued late fine on overdue unpaid assignments
  balance_due_paise:   number;  // net_payable + fine - paid  (never negative)
}

/**
 * Computes a student's fee balance in paise.
 *
 * Rules (SRS 3.4 + Section 6 date rules):
 * - Gross payable = sum of assigned amounts.
 * - Concessions reduce payable, capped per-assignment at the assignment amount
 *   (a waiver can never exceed what was charged).
 * - Late fine accrues from `due_date + 1 day` at the assignment's daily rate,
 *   ONLY while the net amount for that assignment is still outstanding. Once total
 *   paid covers net payable, no further fine accrues (we treat payments as covering
 *   oldest-due assignments first).
 * - Only SUCCESS transactions count as paid; CREATED/PENDING/FAILED are ignored.
 * - Balance due is clamped at 0 (overpayment shows as zero due, not negative).
 *
 * @param assignments  fee assignments applicable to the student
 * @param concessions  concessions granted to the student
 * @param payments     the student's transactions (any status)
 * @param asOf         the reference date (defaults to today) — used for fine accrual
 * @returns FeeBalanceResult with all figures in paise
 */
export function calculateFeeBalance(
  assignments: FeeAssignmentRow[],
  concessions: ConcessionRow[],
  payments: PaymentRow[],
  asOf: Date = new Date(),
): FeeBalanceResult {
  // Sum concessions per assignment, capped at the assignment amount
  const concessionByAssignment = new Map<number, number>();
  for (const c of concessions) {
    concessionByAssignment.set(
      c.assignment_id,
      (concessionByAssignment.get(c.assignment_id) ?? 0) + c.amount_paise,
    );
  }

  let grossPayable = 0;
  let totalConcession = 0;
  let netPayable = 0;

  // Net amount owed per assignment (after concession), used for fine gating
  const netByAssignment: { assignment_id: number; net: number; due: Date; rate: number }[] = [];

  for (const a of assignments) {
    grossPayable += a.amount_paise;
    const rawConcession = concessionByAssignment.get(a.assignment_id) ?? 0;
    const concession = Math.min(rawConcession, a.amount_paise); // cap at charged amount
    totalConcession += concession;
    const net = a.amount_paise - concession;
    netPayable += net;
    netByAssignment.push({
      assignment_id: a.assignment_id,
      net,
      due:  parseDateUTC(a.due_date),
      rate: a.late_fine_per_day_paise,
    });
  }

  const paid = payments
    .filter(p => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount_paise, 0);

  // Fine accrues on assignments whose net is not yet covered by payments.
  // Apply payments to oldest-due assignments first.
  const sortedByDue = [...netByAssignment].sort((a, b) => a.due.getTime() - b.due.getTime());
  let remainingPaid = paid;
  let fine = 0;

  for (const item of sortedByDue) {
    let outstanding = item.net;
    if (remainingPaid > 0) {
      const applied = Math.min(remainingPaid, outstanding);
      outstanding  -= applied;
      remainingPaid -= applied;
    }
    if (outstanding > 0 && item.rate > 0) {
      const daysOverdue = fullDaysBetween(item.due, asOf) - 1; // fine starts due_date + 1
      if (daysOverdue > 0) {
        fine += daysOverdue * item.rate;
      }
    }
  }

  const balanceDue = Math.max(0, netPayable + fine - paid);

  return {
    gross_payable_paise: grossPayable,
    concession_paise:    totalConcession,
    net_payable_paise:   netPayable,
    paid_paise:          paid,
    fine_paise:          fine,
    balance_due_paise:   balanceDue,
  };
}

/** Parses a YYYY-MM-DD string as a UTC midnight Date (timezone-stable for day math). */
function parseDateUTC(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whole days from `from` to `to` (floor). Negative if `to` is before `from`. */
function fullDaysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const fromUTC = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUTC   = Date.UTC(to.getUTCFullYear(),   to.getUTCMonth(),   to.getUTCDate());
  return Math.floor((toUTC - fromUTC) / MS_PER_DAY);
}
