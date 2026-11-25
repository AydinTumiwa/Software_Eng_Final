// Monthly usage report for the Reports page: demand (requests made in the
// month) and usage (VM-days held during the month).

import { BLOCKING_STATUSES, BOOKING_TYPES, VM_CATEGORIES, type BookingStatus } from '../../shared/config';
import { addDays, daysInclusive, parseISODate, todayISO } from '../../shared/dates';
import type { Booking, MonthlyReport } from '../../shared/types';
import { all } from '../db/database';
import { badRequest } from '../http';
import { bookingsRepo } from '../repositories/bookings';
import { vmsRepo } from '../repositories/vms';

// Bookings in these statuses held (or still hold) their VM, so they count as usage.
const HELD: BookingStatus[] = [...BLOCKING_STATUSES, 'completed'];

const monthLabel = (month: string) =>
  parseISODate(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function monthRange(month: string) {
  const start = `${month}-01`;
  const next = parseISODate(start);
  next.setMonth(next.getMonth() + 1);
  const end = addDays(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`, -1);
  return { start, end, days: daysInclusive(start, end) };
}

function shiftMonth(month: string, delta: number) {
  const d = parseISODate(`${month}-01`);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Days of a booking that fall inside [start, end].
function overlapDays(b: Booking, start: string, end: string) {
  const from = b.startDate > start ? b.startDate : start;
  const to = b.endDate < end ? b.endDate : end;
  return to < from ? 0 : daysInclusive(from, to);
}

// SQLite timestamps are "YYYY-MM-DD HH:MM:SS", so the month is the first 7 characters.
const createdMonth = (b: Booking) => b.createdAt.slice(0, 7);

export function monthlyReport(monthInput?: unknown): MonthlyReport {
  const month = monthInput === undefined ? todayISO().slice(0, 7) : String(monthInput);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw badRequest('Month must be in YYYY-MM format.');
  const { start, end, days } = monthRange(month);

  const bookings = bookingsRepo.list();
  const held = bookings.filter((b) => HELD.includes(b.status) && b.vmId);
  const requested = bookings.filter((b) => createdMonth(b) === month);
  const vms = vmsRepo.list().filter((v) => v.status !== 'retired');

  // Usage per VM
  const byVm = vms
    .map((vm) => {
      const mine = held.filter((b) => b.vmId === vm.id && overlapDays(b, start, end) > 0);
      const bookedDays = mine.reduce((sum, b) => sum + overlapDays(b, start, end), 0);
      return {
        vmId: vm.id,
        name: vm.name,
        category: vm.category,
        bookings: mine.length,
        bookedDays,
        utilisation: Math.round((bookedDays / days) * 100),
      };
    })
    .sort((a, b) => b.bookedDays - a.bookedDays || a.name.localeCompare(b.name));
  const bookedDays = byVm.reduce((sum, v) => sum + v.bookedDays, 0);

  const byCategory = VM_CATEGORIES.map((category) => ({
    category,
    requests: requested.filter((b) => b.category === category).length,
    bookedDays: byVm.filter((v) => v.category === category).reduce((sum, v) => sum + v.bookedDays, 0),
  }));

  // How many VMs were held on each day of the month
  const dailyInUse = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    return { date, inUse: new Set(held.filter((b) => b.startDate <= date && b.endDate >= date).map((b) => b.vmId)).size };
  });

  // Status changes that happened during the month
  const events = all<{ to_status: BookingStatus; from_status: BookingStatus | null; actor_id: number | null }>(
    "SELECT to_status, from_status, actor_id FROM booking_events WHERE substr(created_at, 1, 7) = ?",
    month,
  );
  const count = (fn: (e: (typeof events)[number]) => boolean) => events.filter(fn).length;

  const mostBooked = byVm.find((v) => v.bookedDays > 0);
  const topCategory = [...byCategory].sort((a, b) => b.requests - a.requests)[0];

  // Months that have any bookings, for the month picker
  const months = new Set<string>([todayISO().slice(0, 7)]);
  for (const b of bookings) {
    months.add(createdMonth(b));
    for (let m = b.startDate.slice(0, 7); m <= b.endDate.slice(0, 7); m = shiftMonth(m, 1)) months.add(m);
  }

  const trend = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => {
    const r = monthRange(m);
    return {
      month: m,
      label: monthLabel(m),
      requests: bookings.filter((b) => createdMonth(b) === m).length,
      bookedDays: held.reduce((sum, b) => sum + overlapDays(b, r.start, r.end), 0),
    };
  });

  return {
    month,
    label: monthLabel(month),
    startDate: start,
    endDate: end,
    daysInMonth: days,
    availableMonths: [...months].sort().reverse(),
    totals: {
      requests: requested.length,
      bookingsInUse: held.filter((b) => overlapDays(b, start, end) > 0).length,
      bookedDays,
      utilisation: vms.length ? Math.round((bookedDays / (vms.length * days)) * 100) : 0,
      vmsCounted: vms.length,
      queueJoins: count((e) => e.to_status === 'queued' && e.from_status === null),
      rejected: count((e) => e.to_status === 'rejected'),
      cancelled: count((e) => e.to_status === 'cancelled'),
      endedEarly: count((e) => e.to_status === 'purging' && e.from_status === 'active' && e.actor_id !== null),
    },
    mostBookedVm: mostBooked ? { name: mostBooked.name, bookedDays: mostBooked.bookedDays } : null,
    mostRequestedCategory: topCategory && topCategory.requests > 0 ? { category: topCategory.category, requests: topCategory.requests } : null,
    byVm,
    byCategory,
    byType: BOOKING_TYPES.map((type) => ({ type, requests: requested.filter((b) => b.type === type).length })),
    dailyInUse,
    trend,
  };
}
