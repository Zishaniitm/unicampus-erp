/**
 * Unit tests for the fee module's pure logic:
 *   - calculateFeeBalance (SRS Section 9 mandatory function)
 *   - verifyRazorpayWebhookSignature (SRS Section 9 mandatory function)
 *
 * No DB access — these are pure functions. Razorpay tests only need env mocked.
 */

jest.mock('../../src/config/env', () => ({
  env: {
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    RAZORPAY_KEY_SECRET: 'test_key_secret',
    RAZORPAY_KEY_ID: 'rzp_test_123',
    NODE_ENV: 'test',
  },
}));

import crypto from 'crypto';
import {
  calculateFeeBalance,
  type FeeAssignmentRow,
  type ConcessionRow,
  type PaymentRow,
} from '../../src/modules/fee/fee.types';
import {
  verifyRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
} from '../../src/utils/razorpay';

// ── calculateFeeBalance ─────────────────────────────────────
describe('calculateFeeBalance', () => {
  const farFuture = '2999-01-01'; // never overdue

  it('returns all zeros when there are no assignments', () => {
    const r = calculateFeeBalance([], [], []);
    expect(r.gross_payable_paise).toBe(0);
    expect(r.net_payable_paise).toBe(0);
    expect(r.paid_paise).toBe(0);
    expect(r.fine_paise).toBe(0);
    expect(r.balance_due_paise).toBe(0);
  });

  it('sums gross payable across assignments', () => {
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 5000000, due_date: farFuture, late_fine_per_day_paise: 0 },
      { assignment_id: 2, amount_paise: 1500000, due_date: farFuture, late_fine_per_day_paise: 0 },
    ];
    const r = calculateFeeBalance(assignments, [], []);
    expect(r.gross_payable_paise).toBe(6500000);
    expect(r.net_payable_paise).toBe(6500000);
    expect(r.balance_due_paise).toBe(6500000);
  });

  it('applies concessions to reduce net payable', () => {
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 5000000, due_date: farFuture, late_fine_per_day_paise: 0 },
    ];
    const concessions: ConcessionRow[] = [{ assignment_id: 1, amount_paise: 2000000 }];
    const r = calculateFeeBalance(assignments, concessions, []);
    expect(r.concession_paise).toBe(2000000);
    expect(r.net_payable_paise).toBe(3000000);
    expect(r.balance_due_paise).toBe(3000000);
  });

  it('caps a concession at the assignment amount (cannot go negative)', () => {
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 1000000, due_date: farFuture, late_fine_per_day_paise: 0 },
    ];
    const concessions: ConcessionRow[] = [{ assignment_id: 1, amount_paise: 5000000 }]; // absurdly large
    const r = calculateFeeBalance(assignments, concessions, []);
    expect(r.concession_paise).toBe(1000000);   // capped
    expect(r.net_payable_paise).toBe(0);
    expect(r.balance_due_paise).toBe(0);
  });

  it('counts only SUCCESS payments toward paid', () => {
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 5000000, due_date: farFuture, late_fine_per_day_paise: 0 },
    ];
    const payments: PaymentRow[] = [
      { amount_paise: 2000000, status: 'SUCCESS' },
      { amount_paise: 1000000, status: 'PENDING' },  // ignored
      { amount_paise: 1000000, status: 'FAILED' },   // ignored
      { amount_paise: 500000,  status: 'CREATED' },  // ignored
    ];
    const r = calculateFeeBalance(assignments, [], payments);
    expect(r.paid_paise).toBe(2000000);
    expect(r.balance_due_paise).toBe(3000000);
  });

  it('clamps balance at zero on overpayment', () => {
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 1000000, due_date: farFuture, late_fine_per_day_paise: 0 },
    ];
    const payments: PaymentRow[] = [{ amount_paise: 1500000, status: 'SUCCESS' }];
    const r = calculateFeeBalance(assignments, [], payments);
    expect(r.balance_due_paise).toBe(0);
  });

  it('accrues late fine from due_date + 1 day on unpaid overdue assignments', () => {
    // due 2026-01-01, asOf 2026-01-11 => 10 days elapsed, fine days = 10 - 1 = 9
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 1000000, due_date: '2026-01-01', late_fine_per_day_paise: 1000 },
    ];
    const r = calculateFeeBalance(assignments, [], [], new Date(Date.UTC(2026, 0, 11)));
    expect(r.fine_paise).toBe(9 * 1000);
    expect(r.balance_due_paise).toBe(1000000 + 9000);
  });

  it('does not accrue fine before the grace day', () => {
    // asOf == due_date => 0 days elapsed, fine days = -1 => no fine
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 1000000, due_date: '2026-01-01', late_fine_per_day_paise: 1000 },
    ];
    const r = calculateFeeBalance(assignments, [], [], new Date(Date.UTC(2026, 0, 1)));
    expect(r.fine_paise).toBe(0);
  });

  it('stops fine accrual once the assignment is fully paid', () => {
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 1000000, due_date: '2026-01-01', late_fine_per_day_paise: 1000 },
    ];
    const payments: PaymentRow[] = [{ amount_paise: 1000000, status: 'SUCCESS' }];
    const r = calculateFeeBalance(assignments, [], payments, new Date(Date.UTC(2026, 0, 30)));
    expect(r.fine_paise).toBe(0);
    expect(r.balance_due_paise).toBe(0);
  });

  it('applies payments oldest-due first when gating fine', () => {
    // Two overdue assignments; a payment covers the older one fully so only the
    // newer one accrues fine.
    const assignments: FeeAssignmentRow[] = [
      { assignment_id: 1, amount_paise: 1000000, due_date: '2026-01-01', late_fine_per_day_paise: 1000 },
      { assignment_id: 2, amount_paise: 1000000, due_date: '2026-02-01', late_fine_per_day_paise: 1000 },
    ];
    const payments: PaymentRow[] = [{ amount_paise: 1000000, status: 'SUCCESS' }];
    // asOf 2026-02-11 => assignment 2: 10 days elapsed, fine days = 9
    const r = calculateFeeBalance(assignments, [], payments, new Date(Date.UTC(2026, 1, 11)));
    expect(r.fine_paise).toBe(9 * 1000);
    // net 2,000,000 + fine 9,000 - paid 1,000,000
    expect(r.balance_due_paise).toBe(1000000 + 9000);
  });
});

// ── verifyRazorpayWebhookSignature ──────────────────────────
describe('verifyRazorpayWebhookSignature', () => {
  const secret = 'test_webhook_secret';
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });

  function sign(payload: string, key: string): string {
    return crypto.createHmac('sha256', key).update(payload).digest('hex');
  }

  it('returns true for a valid signature', () => {
    const sig = sign(body, secret);
    expect(verifyRazorpayWebhookSignature(body, sig, secret)).toBe(true);
  });

  it('returns false for a tampered body', () => {
    const sig = sign(body, secret);
    const tampered = body.replace('payment.captured', 'payment.failed');
    expect(verifyRazorpayWebhookSignature(tampered, sig, secret)).toBe(false);
  });

  it('returns false for a wrong secret', () => {
    const sig = sign(body, 'wrong_secret');
    expect(verifyRazorpayWebhookSignature(body, sig, secret)).toBe(false);
  });

  it('returns false when the signature header is missing', () => {
    expect(verifyRazorpayWebhookSignature(body, undefined, secret)).toBe(false);
  });

  it('throws when no secret is configured', () => {
    // Empty string is falsy but not undefined, so the env default does not apply.
    expect(() => verifyRazorpayWebhookSignature(body, 'abc', '')).toThrow();
  });

  it('falls back to the env secret when none is passed', () => {
    const sig = sign(body, secret); // env mock secret matches
    expect(verifyRazorpayWebhookSignature(body, sig)).toBe(true);
  });
});

// ── verifyRazorpayPaymentSignature ──────────────────────────
describe('verifyRazorpayPaymentSignature', () => {
  const secret = 'test_key_secret';

  it('validates the order|payment signature', () => {
    const orderId = 'order_1', paymentId = 'pay_1';
    const sig = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    expect(verifyRazorpayPaymentSignature(orderId, paymentId, sig, secret)).toBe(true);
  });

  it('rejects a mismatched signature', () => {
    expect(verifyRazorpayPaymentSignature('order_1', 'pay_1', 'deadbeef', secret)).toBe(false);
  });
});
