import { Router } from 'express';
import { BOOKING_RULES, OS_OPTIONS, SOFTWARE_CATALOG, VM_CATEGORIES, VM_STATUSES } from '../../shared/config';
import { requireAuth, requirePermission } from '../auth';
import { badRequest, conflict, date, idParam, int, notFound, oneOf, optionalStr, str, stringList } from '../http';
import { bookingsRepo } from '../repositories/bookings';
import { vmsRepo, type VmInput } from '../repositories/vms';
import { availability } from '../services/bookings';

export const vmsRouter = Router();
vmsRouter.use(requireAuth());

function parseVm(body: Record<string, unknown>): VmInput {
  return {
    name: str(body.name, 'Name', { max: 60 }),
    category: oneOf(body.category, VM_CATEGORIES, 'Category'),
    cpuCores: int(body.cpuCores, 'CPU cores', { min: 1, max: 256 }),
    memoryGb: int(body.memoryGb, 'Memory', { min: 1, max: 2048 }),
    storageGb: int(body.storageGb, 'Storage', { min: 1, max: 100_000 }),
    os: oneOf(body.os, OS_OPTIONS, 'Operating system'),
    software: stringList(body.software, 'Software', SOFTWARE_CATALOG),
    status: oneOf(body.status ?? 'available', VM_STATUSES, 'Status'),
    notes: optionalStr(body.notes, 'Notes', 500),
  };
}

vmsRouter.get('/', (req, res) => {
  const category = req.query.category ? oneOf(req.query.category, VM_CATEGORIES, 'Category') : undefined;
  res.json(vmsRepo.list(category));
});

// Which VMs in a category are free for a date range and meet the requirements.
vmsRouter.get('/availability', (req, res) => {
  const q = req.query;
  const start = date(q.startDate, 'Start date');
  const end = date(q.endDate, 'End date');
  if (end < start) throw badRequest('The end date must be on or after the start date.');
  res.json(
    availability(oneOf(q.category, VM_CATEGORIES, 'Category'), start, end, {
      cpuCores: int(q.cpuCores ?? 1, 'CPU cores', { min: 1 }),
      memoryGb: int(q.memoryGb ?? 1, 'Memory', { min: 1 }),
      storageGb: int(q.storageGb ?? 1, 'Storage', { min: 1 }),
      software: [],
    }),
  );
});

// Date ranges when a VM is taken, including the purge buffer after each booking.
vmsRouter.get('/:id/blocked', (req, res) => {
  res.json(bookingsRepo.blockedRanges(idParam(req.params.id, 'VM'), BOOKING_RULES.purgeDays));
});

vmsRouter.post('/', requirePermission('manageVms'), (req, res) => {
  const id = vmsRepo.create(parseVm(req.body ?? {}));
  res.status(201).json(vmsRepo.findById(id));
});

vmsRouter.put('/:id', requirePermission('manageVms'), (req, res) => {
  const id = idParam(req.params.id, 'VM');
  if (!vmsRepo.findById(id)) throw notFound('VM');
  vmsRepo.update(id, parseVm(req.body ?? {}));
  res.json(vmsRepo.findById(id));
});

vmsRouter.delete('/:id', requirePermission('manageVms'), (req, res) => {
  const id = idParam(req.params.id, 'VM');
  if (!vmsRepo.findById(id)) throw notFound('VM');
  if (vmsRepo.hasBookings(id)) throw conflict('This VM has bookings. Set its status to "retired" instead of deleting it.');
  vmsRepo.delete(id);
  res.json({ ok: true });
});
