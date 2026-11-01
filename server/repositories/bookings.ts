import { all, get, run } from '../db/database';
import type { Booking, BookingEvent } from '../../shared/types';
import { BLOCKING_STATUSES, type BookingStatus, type BookingType, type VmCategory } from '../../shared/config';

const blockingList = BLOCKING_STATUSES.map((s) => `'${s}'`).join(', ');

interface BookingRow {
  id: number;
  type: BookingType;
  status: BookingStatus;
  status_note: string | null;
  category: VmCategory;
  user_id: number;
  user_name: string;
  user_email: string;
  booked_by_id: number;
  booked_by_name: string;
  vm_id: number | null;
  vm_name: string | null;
  course_id: number | null;
  course_code: string | null;
  course_name: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  req_cpu_cores: number;
  req_memory_gb: number;
  req_storage_gb: number;
  req_software: string;
  purpose: string;
  notes: string | null;
  ready_at: string | null;
  reminder_sent_at: string | null;
  purge_until: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT = `
  SELECT b.*, u.name AS user_name, u.email AS user_email, bb.name AS booked_by_name,
         v.name AS vm_name, c.code AS course_code, c.name AS course_name
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  JOIN users bb ON bb.id = b.booked_by_id
  LEFT JOIN vms v ON v.id = b.vm_id
  LEFT JOIN courses c ON c.id = b.course_id`;

// Queue order: first come, first served.
function queueOrder(): number[] {
  return all<{ id: number }>("SELECT id FROM bookings WHERE status = 'queued' ORDER BY created_at, id").map((r) => r.id);
}

function toBookings(rows: BookingRow[]): Booking[] {
  const queue = rows.some((r) => r.status === 'queued') ? queueOrder() : [];
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    statusNote: row.status_note,
    category: row.category,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    bookedById: row.booked_by_id,
    bookedByName: row.booked_by_name,
    vmId: row.vm_id,
    vmName: row.vm_name,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    requirements: {
      cpuCores: row.req_cpu_cores,
      memoryGb: row.req_memory_gb,
      storageGb: row.req_storage_gb,
      software: JSON.parse(row.req_software),
    },
    purpose: row.purpose,
    notes: row.notes,
    queuePosition: row.status === 'queued' ? queue.indexOf(row.id) + 1 : null,
    readyAt: row.ready_at,
    reminderSentAt: row.reminder_sent_at,
    purgeUntil: row.purge_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export interface BookingFilter {
  userId?: number;
  statuses?: BookingStatus[];
  type?: BookingType;
  vmId?: number;
}

export interface NewBookingRow {
  type: BookingType;
  status: BookingStatus;
  category: VmCategory;
  userId: number;
  bookedById: number;
  vmId: number | null;
  courseId: number | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  software: string[];
  purpose: string;
  notes: string | null;
}

export const bookingsRepo = {
  list(filter: BookingFilter = {}): Booking[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.userId) {
      where.push('(b.user_id = ? OR b.booked_by_id = ?)');
      params.push(filter.userId, filter.userId);
    }
    if (filter.statuses?.length) {
      where.push(`b.status IN (${filter.statuses.map(() => '?').join(', ')})`);
      params.push(...filter.statuses);
    }
    if (filter.type) {
      where.push('b.type = ?');
      params.push(filter.type);
    }
    if (filter.vmId) {
      where.push('b.vm_id = ?');
      params.push(filter.vmId);
    }
    const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY b.start_date DESC, b.id DESC`;
    return toBookings(all<BookingRow>(sql, ...params));
  },

  findById(id: number): Booking | undefined {
    const row = get<BookingRow>(`${SELECT} WHERE b.id = ?`, id);
    return row ? toBookings([row])[0] : undefined;
  },

  queue(): Booking[] {
    return toBookings(all<BookingRow>(`${SELECT} WHERE b.status = 'queued' ORDER BY b.created_at, b.id`));
  },

  // Bookings on a VM that would clash with [start, end] once the purge buffer
  // is added after each booking (theirs and the new one).
  findClashes(vmId: number, start: string, end: string, bufferDays: number, ignoreId?: number) {
    return all<{ id: number }>(
      `SELECT id FROM bookings
       WHERE vm_id = ? AND id != ? AND status IN (${blockingList})
         AND start_date <= date(?, '+' || ? || ' days')
         AND date(end_date, '+' || ? || ' days') >= ?`,
      vmId,
      ignoreId ?? 0,
      end,
      bufferDays,
      bufferDays,
      start,
    );
  },

  // Date ranges (including the purge buffer) when a VM is taken, for the calendar.
  blockedRanges(vmId: number, bufferDays: number) {
    return all<{ start: string; end: string }>(
      `SELECT start_date AS start, date(end_date, '+' || ? || ' days') AS end FROM bookings
       WHERE vm_id = ? AND status IN (${blockingList})
       ORDER BY start_date`,
      bufferDays,
      vmId,
    );
  },

  create(b: NewBookingRow): number {
    return run(
      `INSERT INTO bookings (type, status, category, user_id, booked_by_id, vm_id, course_id, start_date, end_date,
         start_time, end_time, req_cpu_cores, req_memory_gb, req_storage_gb, req_software, purpose, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      b.type,
      b.status,
      b.category,
      b.userId,
      b.bookedById,
      b.vmId,
      b.courseId,
      b.startDate,
      b.endDate,
      b.startTime,
      b.endTime,
      b.cpuCores,
      b.memoryGb,
      b.storageGb,
      JSON.stringify(b.software),
      b.purpose.trim(),
      b.notes,
    ).lastId;
  },

  // Updates only the columns given.
  update(
    id: number,
    fields: Partial<{
      status: BookingStatus;
      status_note: string | null;
      vm_id: number | null;
      start_date: string;
      end_date: string;
      ready_at: string | null;
      reminder_sent_at: string | null;
      purge_until: string | null;
    }>,
  ) {
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (!keys.length) return;
    run(
      `UPDATE bookings SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      ...keys.map((k) => fields[k] ?? null),
      id,
    );
  },

  addEvent(bookingId: number, actorId: number | null, from: BookingStatus | null, to: BookingStatus, note?: string | null) {
    run(
      'INSERT INTO booking_events (booking_id, actor_id, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)',
      bookingId,
      actorId,
      from,
      to,
      note ?? null,
    );
  },

  events(bookingId: number): BookingEvent[] {
    return all<{
      id: number;
      booking_id: number;
      actor_name: string | null;
      from_status: BookingStatus | null;
      to_status: BookingStatus;
      note: string | null;
      created_at: string;
    }>(
      `SELECT e.*, u.name AS actor_name FROM booking_events e LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.booking_id = ? ORDER BY e.created_at, e.id`,
      bookingId,
    ).map((e) => ({
      id: e.id,
      bookingId: e.booking_id,
      actorName: e.actor_name,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      note: e.note,
      createdAt: e.created_at,
    }));
  },

  countBy(column: 'category' | 'status') {
    return all<{ key: string; count: number }>(
      `SELECT ${column} AS key, COUNT(*) AS count FROM bookings GROUP BY ${column} ORDER BY count DESC`,
    );
  },
};
