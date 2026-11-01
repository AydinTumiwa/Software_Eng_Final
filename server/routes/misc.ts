// Notifications, the email log and dashboard numbers.

import { Router } from 'express';
import { can, type BookingStatus, type VmCategory } from '../../shared/config';
import type { DashboardStats } from '../../shared/types';
import { requireAuth, requirePermission } from '../auth';
import { int } from '../http';
import { bookingsRepo } from '../repositories/bookings';
import { emailLogRepo, notificationsRepo } from '../repositories/notifications';
import { vmsRepo } from '../repositories/vms';
import { todayISO } from '../../shared/dates';

export const miscRouter = Router();
miscRouter.use(requireAuth());

miscRouter.get('/notifications', (req, res) => {
  res.json(notificationsRepo.listForUser(req.user!.id));
});

// Body { id } marks one notification read; an empty body marks all read.
miscRouter.post('/notifications/read', (req, res) => {
  notificationsRepo.markRead(req.user!.id, req.body?.id ? int(req.body.id, 'Notification', { min: 1 }) : undefined);
  res.json({ ok: true });
});

miscRouter.get('/emails', requirePermission('viewEmailLog'), (_req, res) => {
  res.json(emailLogRepo.list());
});

miscRouter.get('/stats/dashboard', (req, res) => {
  const user = req.user!;
  const today = todayISO();
  const mine = bookingsRepo.list({ userId: user.id });
  const staff = can(user.role, 'viewAllBookings');
  const everyone = staff ? bookingsRepo.list() : [];
  const vms = vmsRepo.list().filter((v) => v.status !== 'retired');

  const stats: DashboardStats = {
    myActive: mine.filter((b) => b.status === 'active').length,
    myUpcoming: mine.filter((b) => ['pending', 'configuring', 'ready'].includes(b.status) && b.startDate >= today).length,
    myQueued: mine.filter((b) => b.status === 'queued').length,
    pendingTasks: everyone.filter((b) => b.status === 'pending' || b.status === 'configuring').length,
    purgeTasks: everyone.filter((b) => b.status === 'purging').length,
    queueLength: bookingsRepo.queue().length,
    vmsTotal: vms.length,
    vmsInUse: vms.filter((v) => v.currentBooking).length,
    bookingsByCategory: staff
      ? bookingsRepo.countBy('category').map((r) => ({ category: r.key as VmCategory, count: r.count }))
      : [],
    bookingsByStatus: staff
      ? bookingsRepo.countBy('status').map((r) => ({ status: r.key as BookingStatus, count: r.count }))
      : [],
  };
  res.json(stats);
});
