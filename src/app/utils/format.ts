import { formatDate } from '@shared/dates';
import type { Booking } from '@shared/types';

export function initials(name: string): string {
  return name
    .replace(/^(Dr|Prof)\.?\s+/i, '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
}

export function dateRange(b: Pick<Booking, 'startDate' | 'endDate'>): string {
  return b.startDate === b.endDate ? formatDate(b.startDate) : `${formatDate(b.startDate)} – ${formatDate(b.endDate)}`;
}

export function specs(r: { cpuCores: number; memoryGb: number; storageGb: number }): string {
  return `${r.cpuCores} CPU · ${r.memoryGb} GB RAM · ${r.storageGb >= 1000 ? `${r.storageGb / 1000} TB` : `${r.storageGb} GB`} storage`;
}

// SQLite timestamps are UTC without a timezone marker.
export function formatTimestamp(value: string): string {
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
