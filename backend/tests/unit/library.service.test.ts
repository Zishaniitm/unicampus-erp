/**
 * Unit tests for the library module's pure logic:
 *   - calculateLibraryFine (SRS Section 9 mandatory, 95% coverage target)
 * No DB access — pure function tests.
 */

jest.mock('../../src/config/env', () => ({
  env: { NODE_ENV: 'test', TIMEZONE: 'Asia/Kolkata' },
}));

import {
  calculateLibraryFine,
  LOAN_DAYS, DAILY_FINE_PAISE, MAX_BOOKS_PER_STUDENT, FINE_BLOCK_THRESHOLD_PAISE,
} from '../../src/modules/library/library.types';

describe('Library business constants (SRS 3.5)', () => {
  it('has sane defaults', () => {
    expect(LOAN_DAYS).toBe(14);
    expect(DAILY_FINE_PAISE).toBe(500);          // ₹5/day
    expect(MAX_BOOKS_PER_STUDENT).toBe(3);
    expect(FINE_BLOCK_THRESHOLD_PAISE).toBe(10000); // ₹100
  });
});

describe('calculateLibraryFine', () => {
  const RATE = 500; // ₹5/day in paise

  it('returns 0 when returned before the due date', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-05', RATE)).toBe(0);
  });

  it('returns 0 when returned exactly on the due date', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-10', RATE)).toBe(0);
  });

  it('returns 0 on due_date + 1 (grace day — fine STARTS here, so 0 chargeable days)', () => {
    // SRS formula: MAX(0, days_late - 1). One day late => 0 fine days.
    expect(calculateLibraryFine('2026-07-10', '2026-07-11', RATE)).toBe(0);
  });

  it('charges 1 day when returned 2 days after due date', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-12', RATE)).toBe(1 * RATE);
  });

  it('charges 9 days when returned 10 days after due date', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-20', RATE)).toBe(9 * RATE);
  });

  it('excludes holidays inside the chargeable window', () => {
    // 10 days late => 9 fine days; 2 holidays inside window => 7
    const holidays = ['2026-07-13', '2026-07-15'];
    expect(calculateLibraryFine('2026-07-10', '2026-07-20', RATE, holidays)).toBe(7 * RATE);
  });

  it('ignores holidays outside the window', () => {
    const holidays = ['2026-07-01', '2026-08-01']; // before due & after return
    expect(calculateLibraryFine('2026-07-10', '2026-07-20', RATE, holidays)).toBe(9 * RATE);
  });

  it('ignores a holiday ON the due date (not chargeable anyway)', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-20', RATE, ['2026-07-10'])).toBe(9 * RATE);
  });

  it('counts a holiday on the return date itself', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-20', RATE, ['2026-07-20'])).toBe(8 * RATE);
  });

  it('never goes negative even when holidays exceed late days', () => {
    const holidays = ['2026-07-11', '2026-07-12'];
    expect(calculateLibraryFine('2026-07-10', '2026-07-12', RATE, holidays)).toBe(0);
  });

  it('handles month boundaries correctly', () => {
    // due 28 Jun, returned 5 Jul => 7 days late => 6 fine days
    expect(calculateLibraryFine('2026-06-28', '2026-07-05', RATE)).toBe(6 * RATE);
  });

  it('handles year boundaries correctly', () => {
    // due 30 Dec, returned 4 Jan => 5 days late => 4 fine days
    expect(calculateLibraryFine('2026-12-30', '2027-01-04', RATE)).toBe(4 * RATE);
  });

  it('scales with the daily rate', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-20', 1000)).toBe(9 * 1000);
  });

  it('returns 0 with a zero daily rate', () => {
    expect(calculateLibraryFine('2026-07-10', '2026-07-20', 0)).toBe(0);
  });
});
