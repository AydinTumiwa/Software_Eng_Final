import { Router } from 'express';
import { BOOKING_STATUSES, BOOKING_TYPES, can } from '../../shared/config';
import type { Booking, User } from '../../shared/types';
import { requireAuth } from '../auth';
import { forbidden, idParam, notFound, oneOf } from '../http';
import { bookingsRepo } from '../repositories/bookings';
import { applyAction, availableActions, createBooking } from '../services/bookings';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth());

const withActions = (user: User) => (b: Booking): Booking => ({ ...b, actions: availableActions(user, b) });

function canSee(user: User, b: Booking) {
  return b.userId === user.id || b.bookedById === user.id || can(user.role, 'viewAllBookings');
}

// ?scope=all lists everyone's bookings (staff only); otherwise only the
// signed-in user's. Optional filters: status (comma-separated), type.
bookingsRouter.get('/', (req, res) => {
  const user = req.user!;
  const all = req.query.scope === 'all';
  if (all && !can(user.role, 'viewAllBookings')) throw forbidden();
  const statuses = req.query.status
    ? String(req.query.status)
        .split(',')
        .map((s) => oneOf(s, BOOKING_STATUSES, 'Status'))
    : undefined;
  const type = req.query.type ? oneOf(req.query.type, BOOKING_TYPES, 'Type') : undefined;
  res.json(bookingsRepo.list({ userId: all ? undefined : user.id, statuses, type }).map(withActions(user)));
});

// The backup queue. Everyone can see it, but only staff see who is waiting.
bookingsRouter.get('/queue', (req, res) => {
  const user = req.user!;
  const staff = can(user.role, 'viewAllBookings');
  res.json(
    bookingsRepo.queue().map((b) => {
      const visible = staff || b.userId === user.id;
      return withActions(user)({
        ...b,
        userName: visible ? b.userName : 'Another student',
        userEmail: visible ? b.userEmail : '',
        bookedByName: visible ? b.bookedByName : '',
        purpose: visible ? b.purpose : '',
        notes: visible ? b.notes : null,
      });
    }),
  );
});

bookingsRouter.get('/:id', (req, res) => {
  const booking = bookingsRepo.findById(idParam(req.params.id, 'Booking'));
  if (!booking || !canSee(req.user!, booking)) throw notFound('Booking');
  res.json({ ...withActions(req.user!)(booking), events: bookingsRepo.events(booking.id) });
});

bookingsRouter.post('/', (req, res) => {
  res.status(201).json(withActions(req.user!)(createBooking(req.user!, req.body ?? {})));
});

bookingsRouter.post('/:id/actions/:action', (req, res) => {
  const updated = applyAction(req.user!, idParam(req.params.id, 'Booking'), req.params.action, req.body?.note);
  res.json(withActions(req.user!)(updated));
});
