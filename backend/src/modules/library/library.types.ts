import { z } from 'zod';

// ── Business constants (SRS 3.5) ─────────────────────────────
/** Default loan period in days */
export const LOAN_DAYS = 14;
/** Fine per day in paise (₹5/day) — overridable via system_config later */
export const DAILY_FINE_PAISE = 500;
/** Max books a student can have out at once (ERR-LIB-004) */
export const MAX_BOOKS_PER_STUDENT = 3;
/** Unpaid fines at/above this block new issues (ERR-LIB-002) — ₹100 */
export const FINE_BLOCK_THRESHOLD_PAISE = 10000;

// ── Validation schemas ───────────────────────────────────────

export const CreateBookSchema = z.object({
  isbn:         z.string().max(20).optional(),
  title:        z.string().min(2).max(300),
  author:       z.string().min(2).max(200),
  publisher:    z.string().max(200).optional(),
  category:     z.string().max(50).optional(),
  edition:      z.string().max(30).optional(),
  total_copies: z.number().int().min(1).max(1000),
  rack_number:  z.string().max(20).optional(),
});

export const UpdateBookSchema = CreateBookSchema.partial();

export const IssueBookSchema = z.object({
  book_id:    z.number().int().positive(),
  student_id: z.number().int().positive(),
  /** Optional override; defaults to LOAN_DAYS from today */
  due_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ReturnBookSchema = z.object({
  issue_id: z.number().int().positive(),
  /** Mark as lost instead of returned (fine handled separately) */
  lost:     z.boolean().optional().default(false),
});

export const PayFineSchema = z.object({
  fine_id: z.number().int().positive(),
});

export const WaiveFineSchema = z.object({
  fine_id: z.number().int().positive(),
  reason:  z.string().min(5).max(500),
});

export const BookSearchQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(20),
  search:   z.string().max(100).optional(),
  category: z.string().max(50).optional(),
});

export type CreateBookInput  = z.infer<typeof CreateBookSchema>;
export type UpdateBookInput  = z.infer<typeof UpdateBookSchema>;
export type IssueBookInput   = z.infer<typeof IssueBookSchema>;
export type ReturnBookInput  = z.infer<typeof ReturnBookSchema>;
export type BookSearchQuery  = z.infer<typeof BookSearchQuerySchema>;

// ── Pure fine calculation (SRS Section 9 — MUST be unit-tested) ──

/**
 * Calculates a library late fine in paise.
 *
 * Rules (SRS Section 6):
 * - Fine starts on due_date + 1 day (one grace day):
 *     fine_days = (returnDate - dueDate) - 1, floored at 0
 * - Holidays (from system_config holidays_YYYY) do NOT accrue fine:
 *     any holiday strictly after due_date and on/before the return date
 *     reduces fine_days by one each.
 * - Returned on or before due date → 0.
 *
 * @param dueDate    the issue's due date (YYYY-MM-DD)
 * @param returnDate actual return date, or "today" while still out (YYYY-MM-DD)
 * @param dailyRatePaise fine per chargeable day, in paise
 * @param holidays   list of holiday dates (YYYY-MM-DD)
 * @returns fine amount in paise (never negative)
 */
export function calculateLibraryFine(
  dueDate: string,
  returnDate: string,
  dailyRatePaise: number,
  holidays: string[] = [],
): number {
  const due = parseDateUTC(dueDate);
  const ret = parseDateUTC(returnDate);

  const elapsed = daysBetween(due, ret);   // whole days after due date
  let fineDays = elapsed - 1;              // grace: fine starts due_date + 1
  if (fineDays <= 0) return 0;

  // Remove holidays that fall inside the chargeable window (due+1 .. return)
  if (holidays.length > 0) {
    const dueMs = due.getTime();
    const retMs = ret.getTime();
    const holidayCount = holidays.reduce((count, h) => {
      const hMs = parseDateUTC(h).getTime();
      return hMs > dueMs && hMs <= retMs ? count + 1 : count;
    }, 0);
    fineDays = Math.max(0, fineDays - holidayCount);
  }

  return fineDays * dailyRatePaise;
}

/** Parses YYYY-MM-DD as UTC midnight (timezone-stable day math). */
function parseDateUTC(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whole days from a to b (can be negative). */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
