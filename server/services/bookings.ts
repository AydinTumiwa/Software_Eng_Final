// Booking rules: who may book what, which VM is free, status changes, and
// the backup queue. The numbers used here come from BOOKING_RULES in
// shared/config.ts.

import {
  BOOKING_ACTIONS,
  BOOKING_RULES,
  SOFTWARE_CATALOG,
  VM_CATEGORIES,
  can,
  type BookingAction,
  type VmCategory,
} from '../../shared/config';
import { addDays, daysInclusive, todayISO } from '../../shared/dates';
import type { Booking, NewBookingInput, Requirements, User, Vm, VmAvailability } from '../../shared/types';
import { transaction } from '../db/database';
import { badRequest, conflict, date, forbidden, int, notFound, oneOf, optionalStr, str, stringList, time } from '../http';
import { bookingsRepo } from '../repositories/bookings';
import { coursesRepo } from '../repositories/courses';
import { vmsRepo } from '../repositories/vms';
import { messages } from './messages';
import { notifyLabAssistants, notifyUser } from './notify';

const { purgeDays } = BOOKING_RULES;

export function meetsRequirements(vm: Vm, req: Requirements): boolean {
  return vm.cpuCores >= req.cpuCores && vm.memoryGb >= req.memoryGb && vm.storageGb >= req.storageGb;
}

export function isVmFree(vmId: number, start: string, end: string, ignoreBookingId?: number): boolean {
  return bookingsRepo.findClashes(vmId, start, end, purgeDays, ignoreBookingId).length === 0;
}

// VMs in a category with whether each one is free for the dates and big
// enough for the requirements. Smallest suitable VMs come first so larger
// ones stay free for heavier work.
export function availability(category: VmCategory, start: string, end: string, req: Requirements): VmAvailability[] {
  return vmsRepo
    .list(category)
    .filter((vm) => vm.status === 'available')
    .map((vm) => ({ ...vm, meetsRequirements: meetsRequirements(vm, req), available: isVmFree(vm.id, start, end) }))
    .sort((a, b) => a.cpuCores - b.cpuCores || a.memoryGb - b.memoryGb || a.storageGb - b.storageGb);
}

function pickVm(category: VmCategory, start: string, end: string, req: Requirements): VmAvailability | undefined {
  return availability(category, start, end, req).find((vm) => vm.available && vm.meetsRequirements);
}

export function parseRequirements(value: unknown): Requirements {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    cpuCores: int(r.cpuCores, 'CPU cores', { min: 1, max: 256 }),
    memoryGb: int(r.memoryGb, 'Memory', { min: 1, max: 2048 }),
    storageGb: int(r.storageGb, 'Storage', { min: 1, max: 100_000 }),
    software: stringList(r.software, 'Software', SOFTWARE_CATALOG),
  };
}

function checkDates(start: string, end: string, maxDays: number) {
  const earliest = addDays(todayISO(), BOOKING_RULES.minLeadDays);
  if (start < earliest) throw badRequest('The start date is too early.');
  if (end < start) throw badRequest('The end date must be on or after the start date.');
  if (daysInclusive(start, end) > maxDays) throw badRequest(`A booking of this type can last at most ${maxDays} days.`);
}

// --- Creating bookings -----------------------------------------------------

export function createBooking(actor: User, body: Record<string, unknown>): Booking {
  const type = oneOf(body.type, ['teaching', 'backup'] as const, 'Booking type');
  if (type === 'teaching' && !can(actor.role, 'bookTeaching')) throw forbidden('Your role cannot make teaching reservations.');
  if (type === 'backup' && !can(actor.role, 'bookBackup')) throw forbidden('Your role cannot make backup reservations.');
  const startDate = date(body.startDate, 'Start date');
  const endDate = date(body.endDate, 'End date');
  const requirements = parseRequirements(body.requirements);
  const purpose = str(body.purpose, 'Purpose', { max: 300 });
  const notes = optionalStr(body.notes, 'Notes');
  const requestedVmId = body.vmId ? int(body.vmId, 'VM', { min: 1 }) : undefined;

  let input: Omit<NewBookingInput, 'requirements' | 'purpose'> & { userId: number; category: VmCategory };

  if (type === 'teaching') {
    const course = coursesRepo.findById(int(body.courseId, 'Course', { min: 1 }));
    if (!course) throw notFound('Course');
    if (course.lecturerId !== actor.id && !can(actor.role, 'bookOnBehalf')) {
      throw forbidden('You can only book for courses you teach.');
    }
    checkDates(startDate, endDate, BOOKING_RULES.teachingMaxDays);
    input = {
      type,
      userId: course.lecturerId,
      courseId: course.id,
      category: body.category ? oneOf(body.category, VM_CATEGORIES, 'Category') : course.program,
      startDate,
      endDate,
      startTime: body.startTime ? time(body.startTime, 'Start time') : course.startTime,
      endTime: body.endTime ? time(body.endTime, 'End time') : course.endTime,
    };
  } else {
    checkDates(startDate, endDate, BOOKING_RULES.backupMaxDays);
    input = { type, userId: actor.id, category: 'BACKUP', startDate, endDate };
  }

  let vmId: number | null = null;
  if (requestedVmId) {
    const vm = vmsRepo.findById(requestedVmId);
    if (!vm || vm.status !== 'available' || vm.category !== input.category) throw badRequest('That VM cannot be booked.');
    if (!meetsRequirements(vm, requirements)) throw badRequest(`${vm.name} does not meet the requirements.`);
    if (!isVmFree(vm.id, startDate, endDate)) throw conflict(`${vm.name} is already booked for those dates.`);
    vmId = vm.id;
  } else {
    vmId = pickVm(input.category, startDate, endDate, requirements)?.id ?? null;
  }

  if (!vmId && type === 'teaching') {
    throw conflict('No virtual machine in this category meets the requirements for those dates.');
  }

  const status = vmId ? 'pending' : 'queued';
  const id = transaction(() => {
    const newId = bookingsRepo.create({
      type,
      status,
      category: input.category,
      userId: input.userId,
      bookedById: actor.id,
      vmId,
      courseId: input.courseId ?? null,
      startDate,
      endDate,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      ...requirements,
      purpose,
      notes,
    });
    bookingsRepo.addEvent(newId, actor.id, null, status);
    return newId;
  });

  const booking = bookingsRepo.findById(id)!;
  if (status === 'queued') {
    notifyUser(booking.userId, messages.userQueuedInApp(booking));
  } else {
    notifyLabAssistants(messages.labNewRequest(booking), messages.labNewRequestInApp(booking));
    if (booking.userId === actor.id) {
      notifyUser(booking.userId, messages.userSubmittedInApp(booking));
    } else {
      notifyUser(booking.userId, messages.userBookedOnBehalfInApp(booking), messages.userBookedOnBehalf(booking));
    }
  }
  return booking;
}

// --- Status changes made by people -----------------------------------------

export function availableActions(actor: User, booking: Booking): BookingAction[] {
  const isOwner = booking.userId === actor.id || booking.bookedById === actor.id;
  return (Object.keys(BOOKING_ACTIONS) as BookingAction[]).filter((key) => {
    const action = BOOKING_ACTIONS[key];
    const allowed = (action.roles as string[]).includes(actor.role) || (action.allowOwner && isOwner);
    return allowed && (action.from as string[]).includes(booking.status);
  });
}

export function applyAction(actor: User, bookingId: number, actionKey: string, noteInput: unknown): Booking {
  const booking = bookingsRepo.findById(bookingId);
  if (!booking) throw notFound('Booking');
  if (!(actionKey in BOOKING_ACTIONS)) throw notFound('Action');
  const key = actionKey as BookingAction;
  const action = BOOKING_ACTIONS[key];

  if (!availableActions(actor, booking).includes(key)) {
    throw (action.from as string[]).includes(booking.status)
      ? forbidden()
      : conflict(`This booking is "${booking.status}", so it cannot be changed that way.`);
  }
  const note = action.requiresNote ? str(noteInput, 'Reason', { max: 500 }) : optionalStr(noteInput, 'Note', 500);

  transaction(() => {
    bookingsRepo.update(booking.id, {
      status: action.to,
      status_note: note ?? booking.statusNote,
      ...(key === 'markReady' ? { ready_at: new Date().toISOString() } : {}),
    });
    bookingsRepo.addEvent(booking.id, actor.id, booking.status, action.to, note);
  });

  const updated = bookingsRepo.findById(booking.id)!;
  if (key === 'markReady') notifyUser(updated.userId, messages.userReadyInApp(updated), messages.userReady(updated));
  if (key === 'reject') notifyUser(updated.userId, messages.userRejectedInApp(updated), messages.userRejected(updated));
  if (key === 'cancel' && updated.vmId && booking.status !== 'queued') {
    notifyLabAssistants(messages.labCancelled(updated), messages.labCancelledInApp(updated));
  }
  // A VM may have just been freed up for someone waiting in the queue.
  if (key === 'cancel' || key === 'reject' || key === 'completePurge') processQueue();
  return updated;
}

// --- Backup queue ----------------------------------------------------------

// Gives free backup VMs to queued requests, first come first served. A
// request whose start date has passed keeps its length but starts today.
export function processQueue() {
  const today = todayISO();
  for (const queued of bookingsRepo.queue()) {
    const length = daysInclusive(queued.startDate, queued.endDate);
    const start = queued.startDate < today ? today : queued.startDate;
    const end = addDays(start, length - 1);
    const vm = pickVm(queued.category, start, end, queued.requirements);
    if (!vm) continue;

    transaction(() => {
      bookingsRepo.update(queued.id, { status: 'pending', vm_id: vm.id, start_date: start, end_date: end });
      bookingsRepo.addEvent(queued.id, null, 'queued', 'pending', `Assigned ${vm.name} from the queue`);
    });
    const booking = bookingsRepo.findById(queued.id)!;
    notifyUser(booking.userId, messages.userAllocatedInApp(booking), messages.userAllocated(booking));
    notifyLabAssistants(messages.labNewRequest(booking), messages.labNewRequestInApp(booking));
  }
}
