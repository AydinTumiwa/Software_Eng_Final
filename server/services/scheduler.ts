// Runs on a timer (and once at start-up) to make the date-driven changes:
//   ready  → active   when the start date arrives
//   active → purging  after the end date; lab assistants are told to purge
//   backup reminders  a few days before a backup reservation ends
//   queue             hands newly free backup VMs to waiting students

import { BOOKING_RULES } from '../../shared/config';
import { addDays, todayISO } from '../../shared/dates';
import { transaction } from '../db/database';
import { bookingsRepo } from '../repositories/bookings';
import { messages } from './messages';
import { notifyLabAssistants, notifyUser } from './notify';
import { processQueue } from './bookings';

export function runScheduledTasks() {
  const today = todayISO();

  for (const b of bookingsRepo.list({ statuses: ['ready'] })) {
    if (b.startDate > today || b.endDate < today) continue;
    transaction(() => {
      bookingsRepo.update(b.id, { status: 'active' });
      bookingsRepo.addEvent(b.id, null, 'ready', 'active');
    });
    notifyUser(b.userId, messages.userStartedInApp(b));
  }

  for (const b of bookingsRepo.list({ statuses: ['ready', 'active'] })) {
    if (b.endDate >= today) continue;
    const purgeUntil = addDays(b.endDate, BOOKING_RULES.purgeDays);
    transaction(() => {
      bookingsRepo.update(b.id, { status: 'purging', purge_until: purgeUntil });
      bookingsRepo.addEvent(b.id, null, b.status, 'purging');
    });
    const updated = bookingsRepo.findById(b.id)!;
    notifyUser(updated.userId, messages.userEndedInApp(updated));
    notifyLabAssistants(messages.labPurge(updated), messages.labPurgeInApp(updated));
  }

  const remindFrom = addDays(today, BOOKING_RULES.backupReminderDaysBeforeEnd);
  for (const b of bookingsRepo.list({ type: 'backup', statuses: ['ready', 'active'] })) {
    if (b.reminderSentAt || b.endDate > remindFrom) continue;
    bookingsRepo.update(b.id, { reminder_sent_at: new Date().toISOString() });
    notifyUser(b.userId, messages.userBackupReminderInApp(b), messages.userBackupReminder(b));
  }

  processQueue();
}

export function startScheduler() {
  const run = () => {
    try {
      runScheduledTasks();
    } catch (error) {
      console.error('Scheduled tasks failed:', error);
    }
  };
  run();
  return setInterval(run, BOOKING_RULES.schedulerIntervalMinutes * 60_000);
}
