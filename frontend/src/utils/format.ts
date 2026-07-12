/** Format a date string to DD MMM YYYY e.g. 01 Jan 2026 */
export function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Format time string HH:MM:SS to HH:MM AM/PM */
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

/** Get current day name e.g. "Monday" */
export function getTodayName(): string {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long' })
}

/** Format currency in Indian Rupees */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

/** Get attendance color class based on percentage */
export function getAttendanceColor(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 75) return 'success'
  if (pct >= 65) return 'warning'
  return 'danger'
}
