/** Returns the current day name in IST e.g. "Monday" */
export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  });
}

/** Returns current timestamp in IST as ISO string */
export function nowIST(): string {
  return new Date().toLocaleString('en-CA', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
  });
}
