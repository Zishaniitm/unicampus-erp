/**
 * Registration window helper — shared by hostel, bus, and (later) semester
 * registration modules.
 *
 * SRS Section 6 (Date/Time Rules): windows are evaluated SERVER-SIDE.
 * Never trust client timestamps.
 */

export interface RegistrationWindow {
  window_id:     number;
  window_type:   string;
  academic_year: string;
  opens_at:      string | Date;
  closes_at:     string | Date;
  is_active:     boolean;
}

/**
 * Returns true when `now` falls inside the window [opens_at, closes_at]
 * and the window is active.
 *
 * (SRS Section 9 — mandatory unit-tested function.)
 *
 * @param window the registration window record (or null/undefined if none configured)
 * @param now    reference time — defaults to the server's current time
 */
export function isRegistrationWindowOpen(
  window: RegistrationWindow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!window || !window.is_active) return false;
  const opens  = new Date(window.opens_at).getTime();
  const closes = new Date(window.closes_at).getTime();
  const t = now.getTime();
  return t >= opens && t <= closes;
}
