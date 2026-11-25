// Date helpers shared by the server and the website. Booking dates are stored
// as 'YYYY-MM-DD' strings in local time, which also sort correctly as text.

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

// Whole days from `from` to `to` (negative when `to` is earlier).
export function diffDays(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

// Number of calendar days a booking covers, counting both ends.
export function daysInclusive(start: string, end: string): number {
  return diffDays(start, end) + 1;
}

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(parseISODate(value).getTime());
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
