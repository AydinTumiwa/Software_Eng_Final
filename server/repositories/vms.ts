import { all, get, run } from '../db/database';
import type { Vm } from '../../shared/types';
import { BLOCKING_STATUSES, type BookingStatus, type VmCategory, type VmStatus } from '../../shared/config';
import { todayISO } from '../../shared/dates';

interface VmRow {
  id: number;
  name: string;
  category: VmCategory;
  cpu_cores: number;
  memory_gb: number;
  storage_gb: number;
  os: string;
  software: string;
  status: VmStatus;
  notes: string | null;
}

interface VmBookingRow {
  id: number;
  vm_id: number;
  status: BookingStatus;
  start_date: string;
  end_date: string;
  user_name: string;
}

export interface VmInput {
  name: string;
  category: VmCategory;
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  os: string;
  software: string[];
  status: VmStatus;
  notes: string | null;
}

const blockingList = BLOCKING_STATUSES.map((s) => `'${s}'`).join(', ');

// Adds who is using each VM now and when it is next booked.
function withOccupancy(rows: VmRow[]): Vm[] {
  const today = todayISO();
  const bookings = all<VmBookingRow>(
    `SELECT b.id, b.vm_id, b.status, b.start_date, b.end_date, u.name AS user_name
     FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.vm_id IS NOT NULL AND b.status IN (${blockingList})
     ORDER BY b.start_date`,
  );

  return rows.map((row) => {
    const mine = bookings.filter((b) => b.vm_id === row.id);
    const current = mine.find((b) => b.status === 'purging' || (b.start_date <= today && b.end_date >= today));
    const next = mine.find((b) => b.start_date > today);
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      cpuCores: row.cpu_cores,
      memoryGb: row.memory_gb,
      storageGb: row.storage_gb,
      os: row.os,
      software: JSON.parse(row.software),
      status: row.status,
      notes: row.notes,
      currentBooking: current
        ? { id: current.id, status: current.status, endDate: current.end_date, userName: current.user_name }
        : null,
      nextBooking: next ? { id: next.id, startDate: next.start_date } : null,
    };
  });
}

export const vmsRepo = {
  list(category?: VmCategory): Vm[] {
    const rows = category
      ? all<VmRow>('SELECT * FROM vms WHERE category = ? ORDER BY name', category)
      : all<VmRow>('SELECT * FROM vms ORDER BY category, name');
    return withOccupancy(rows);
  },

  findById(id: number): Vm | undefined {
    const row = get<VmRow>('SELECT * FROM vms WHERE id = ?', id);
    return row ? withOccupancy([row])[0] : undefined;
  },

  create(vm: VmInput): number {
    return run(
      `INSERT INTO vms (name, category, cpu_cores, memory_gb, storage_gb, os, software, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      vm.name.trim(),
      vm.category,
      vm.cpuCores,
      vm.memoryGb,
      vm.storageGb,
      vm.os,
      JSON.stringify(vm.software),
      vm.status,
      vm.notes,
    ).lastId;
  },

  update(id: number, vm: VmInput) {
    run(
      `UPDATE vms SET name = ?, category = ?, cpu_cores = ?, memory_gb = ?, storage_gb = ?, os = ?,
         software = ?, status = ?, notes = ?
       WHERE id = ?`,
      vm.name.trim(),
      vm.category,
      vm.cpuCores,
      vm.memoryGb,
      vm.storageGb,
      vm.os,
      JSON.stringify(vm.software),
      vm.status,
      vm.notes,
      id,
    );
  },

  hasBookings(id: number): boolean {
    return !!get('SELECT 1 FROM bookings WHERE vm_id = ? LIMIT 1', id);
  },

  delete(id: number) {
    run('DELETE FROM vms WHERE id = ?', id);
  },
};
