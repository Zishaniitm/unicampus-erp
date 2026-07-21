/**
 * Unit tests for Week 9 pure logic:
 *   - isRegistrationWindowOpen (SRS Section 9 mandatory function)
 *   - currentAcademicYear helper
 */

jest.mock('../../src/config/env', () => ({
  env: { NODE_ENV: 'test', TIMEZONE: 'Asia/Kolkata' },
}));

import { isRegistrationWindowOpen, type RegistrationWindow } from '../../src/utils/registrationWindow';
import { currentAcademicYear } from '../../src/modules/hostel/hostel.types';

function makeWindow(overrides: Partial<RegistrationWindow> = {}): RegistrationWindow {
  return {
    window_id: 1,
    window_type: 'hostel',
    academic_year: '2026-2027',
    opens_at:  '2026-07-01T00:00:00+05:30',
    closes_at: '2026-07-31T23:59:59+05:30',
    is_active: true,
    ...overrides,
  };
}

describe('isRegistrationWindowOpen', () => {
  it('returns false when no window is configured', () => {
    expect(isRegistrationWindowOpen(null)).toBe(false);
    expect(isRegistrationWindowOpen(undefined)).toBe(false);
  });

  it('returns false when the window is inactive', () => {
    const w = makeWindow({ is_active: false });
    expect(isRegistrationWindowOpen(w, new Date('2026-07-15T12:00:00+05:30'))).toBe(false);
  });

  it('returns true inside the window', () => {
    expect(isRegistrationWindowOpen(makeWindow(), new Date('2026-07-15T12:00:00+05:30'))).toBe(true);
  });

  it('returns true exactly at opens_at (inclusive)', () => {
    expect(isRegistrationWindowOpen(makeWindow(), new Date('2026-07-01T00:00:00+05:30'))).toBe(true);
  });

  it('returns true exactly at closes_at (inclusive)', () => {
    expect(isRegistrationWindowOpen(makeWindow(), new Date('2026-07-31T23:59:59+05:30'))).toBe(true);
  });

  it('returns false before the window opens', () => {
    expect(isRegistrationWindowOpen(makeWindow(), new Date('2026-06-30T23:59:59+05:30'))).toBe(false);
  });

  it('returns false after the window closes', () => {
    expect(isRegistrationWindowOpen(makeWindow(), new Date('2026-08-01T00:00:01+05:30'))).toBe(false);
  });

  it('respects timezone offsets — same instant in UTC counts as open', () => {
    // 2026-07-01T00:00:00+05:30 === 2026-06-30T18:30:00Z
    expect(isRegistrationWindowOpen(makeWindow(), new Date('2026-06-30T18:30:00Z'))).toBe(true);
    expect(isRegistrationWindowOpen(makeWindow(), new Date('2026-06-30T18:29:59Z'))).toBe(false);
  });

  it('accepts Date objects for opens_at/closes_at', () => {
    const w = makeWindow({
      opens_at:  new Date('2026-07-01T00:00:00+05:30'),
      closes_at: new Date('2026-07-31T23:59:59+05:30'),
    });
    expect(isRegistrationWindowOpen(w, new Date('2026-07-10T10:00:00+05:30'))).toBe(true);
  });
});

describe('currentAcademicYear', () => {
  it('returns YYYY-(YYYY+1) from July onwards', () => {
    expect(currentAcademicYear(new Date('2026-07-20T10:00:00+05:30'))).toBe('2026-2027');
    expect(currentAcademicYear(new Date('2026-12-31T10:00:00+05:30'))).toBe('2026-2027');
  });

  it('returns (YYYY-1)-YYYY before July', () => {
    expect(currentAcademicYear(new Date('2026-01-15T10:00:00+05:30'))).toBe('2025-2026');
    expect(currentAcademicYear(new Date('2026-06-30T10:00:00+05:30'))).toBe('2025-2026');
  });

  it('handles the June/July IST boundary', () => {
    // 2026-06-30T20:00Z is already 2026-07-01 01:30 IST → new academic year
    expect(currentAcademicYear(new Date('2026-06-30T20:00:00Z'))).toBe('2026-2027');
  });
});
