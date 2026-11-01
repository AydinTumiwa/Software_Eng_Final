// All wording for emails and in-app notifications lives here, so it can be
// changed without touching the booking logic.

import { APP_NAME, BOOKING_RULES, BOOKING_TYPE_LABELS, ROLE_LABELS, VM_CATEGORY_LABELS, type Role } from '../../shared/config';
import { formatDate } from '../../shared/dates';
import type { Booking } from '../../shared/types';
import { env } from '../env';
import type { EmailMessage } from './email';

export interface InAppMessage {
  type: string;
  title: string;
  message: string;
  link: string;
}

const link = (path: string) => `${env.appUrl}${path}`;
const dates = (b: Booking) => `${formatDate(b.startDate)} – ${formatDate(b.endDate)}`;

// The block of booking details included in lab assistant emails.
function details(b: Booking): string {
  const lines = [
    `Booking #${b.id} (${BOOKING_TYPE_LABELS[b.type]})`,
    `For: ${b.userName} <${b.userEmail}>`,
    b.bookedById !== b.userId ? `Requested by: ${b.bookedByName}` : null,
    b.courseCode ? `Course: ${b.courseCode} ${b.courseName}` : null,
    `Category: ${VM_CATEGORY_LABELS[b.category]}`,
    `Virtual machine: ${b.vmName ?? 'not assigned yet'}`,
    `Dates: ${dates(b)}`,
    b.startTime ? `Class time: ${b.startTime}–${b.endTime}` : null,
    '',
    'Requirements:',
    `  CPU: ${b.requirements.cpuCores} cores`,
    `  Memory: ${b.requirements.memoryGb} GB`,
    `  Storage: ${b.requirements.storageGb} GB`,
    `  Software: ${b.requirements.software.join(', ') || 'none specified'}`,
    '',
    `Purpose: ${b.purpose}`,
    b.notes ? `Notes: ${b.notes}` : null,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

const signOff = `\n\n— ${APP_NAME}`;

export const messages = {
  // --- To lab assistants ---------------------------------------------------

  labNewRequest: (b: Booking): EmailMessage => ({
    subject: `[Lab booking] New ${b.type} request #${b.id} – ${b.vmName} from ${formatDate(b.startDate)}`,
    body:
      `A new booking needs a virtual machine configured.\n\n${details(b)}\n\n` +
      `Open the lab tasks page to start configuring and mark the system ready:\n${link('/app/lab-tasks')}${signOff}`,
  }),

  labNewRequestInApp: (b: Booking): InAppMessage => ({
    type: 'lab-task',
    title: 'New VM to configure',
    message: `${b.userName} needs ${b.vmName} configured for ${dates(b)}.`,
    link: '/app/lab-tasks',
  }),

  labCancelled: (b: Booking): EmailMessage => ({
    subject: `[Lab booking] Booking #${b.id} cancelled – ${b.vmName ?? 'no VM'}`,
    body: `This booking was cancelled and no longer needs a virtual machine.\n\n${details(b)}${signOff}`,
  }),

  labPurge: (b: Booking): EmailMessage => ({
    subject: `[Lab booking] Purge & reconfigure ${b.vmName} by ${formatDate(b.purgeUntil!)}`,
    body:
      `Booking #${b.id} ended on ${formatDate(b.endDate)}. Please purge ${b.vmName} and reconfigure it ` +
      `by ${formatDate(b.purgeUntil!)} (${BOOKING_RULES.purgeDays} days).\n\n${details(b)}\n\n` +
      `Mark it done on the lab tasks page:\n${link('/app/lab-tasks')}${signOff}`,
  }),

  labPurgeInApp: (b: Booking): InAppMessage => ({
    type: 'lab-task',
    title: 'VM to purge',
    message: `Purge and reconfigure ${b.vmName} by ${formatDate(b.purgeUntil!)}.`,
    link: '/app/lab-tasks',
  }),

  labCancelledInApp: (b: Booking): InAppMessage => ({
    type: 'cancelled',
    title: 'Booking cancelled',
    message: `Booking #${b.id} on ${b.vmName ?? 'no VM'} was cancelled.`,
    link: '/app/lab-tasks',
  }),

  // --- To the person the booking is for ------------------------------------

  userReady: (b: Booking): EmailMessage => ({
    subject: `Your virtual machine ${b.vmName} is ready`,
    body:
      `Hi ${b.userName},\n\nThe lab assistant has finished setting up ${b.vmName} for booking #${b.id}.\n` +
      `It is available ${dates(b)}${b.startTime ? `, class time ${b.startTime}–${b.endTime}` : ''}.\n\n` +
      `${link('/app/bookings')}${signOff}`,
  }),
  userReadyInApp: (b: Booking): InAppMessage => ({
    type: 'ready',
    title: 'System ready',
    message: `${b.vmName} is configured and ready for ${dates(b)}.`,
    link: '/app/bookings',
  }),

  userRejected: (b: Booking): EmailMessage => ({
    subject: `Booking #${b.id} was rejected`,
    body:
      `Hi ${b.userName},\n\nYour ${BOOKING_TYPE_LABELS[b.type].toLowerCase()} for ${dates(b)} was rejected.\n` +
      `Reason: ${b.statusNote}\n\n${link('/app/bookings')}${signOff}`,
  }),
  userRejectedInApp: (b: Booking): InAppMessage => ({
    type: 'rejected',
    title: 'Booking rejected',
    message: `Booking #${b.id} was rejected: ${b.statusNote}`,
    link: '/app/bookings',
  }),

  userSubmittedInApp: (b: Booking): InAppMessage => ({
    type: 'submitted',
    title: 'Booking request sent',
    message: `Booking #${b.id} on ${b.vmName} (${dates(b)}) was sent to the lab assistant.`,
    link: '/app/bookings',
  }),

  userBookedOnBehalf: (b: Booking): EmailMessage => ({
    subject: `A lab VM was booked for ${b.courseCode ?? 'your class'}`,
    body:
      `Hi ${b.userName},\n\n${b.bookedByName} booked ${b.vmName} for ${b.courseCode} ${b.courseName}, ` +
      `${dates(b)}. You will get another email when the lab assistant marks it ready.\n\n` +
      `${link('/app/bookings')}${signOff}`,
  }),
  userBookedOnBehalfInApp: (b: Booking): InAppMessage => ({
    type: 'submitted',
    title: 'VM booked for your class',
    message: `${b.bookedByName} booked ${b.vmName} for ${b.courseCode} (${dates(b)}).`,
    link: '/app/bookings',
  }),

  userQueuedInApp: (b: Booking): InAppMessage => ({
    type: 'queued',
    title: 'Added to the backup queue',
    message: `No backup VM is free for ${dates(b)}. You are number ${b.queuePosition} in the queue.`,
    link: '/app/queue',
  }),

  userAllocated: (b: Booking): EmailMessage => ({
    subject: `A backup VM is now assigned to you`,
    body:
      `Hi ${b.userName},\n\nYour place in the backup queue came up. ${b.vmName} is reserved for you ` +
      `${dates(b)}. The lab assistant will now configure it and you will get another email when it is ready.\n\n` +
      `${link('/app/bookings')}${signOff}`,
  }),
  userAllocatedInApp: (b: Booking): InAppMessage => ({
    type: 'allocated',
    title: 'Backup VM assigned',
    message: `${b.vmName} is reserved for you ${dates(b)}.`,
    link: '/app/bookings',
  }),

  userStartedInApp: (b: Booking): InAppMessage => ({
    type: 'active',
    title: 'Booking started',
    message: `Your booking on ${b.vmName} is now active until ${formatDate(b.endDate)}.`,
    link: '/app/bookings',
  }),

  userBackupReminder: (b: Booking): EmailMessage => ({
    subject: `Back up your data: ${b.vmName} booking ends ${formatDate(b.endDate)}`,
    body:
      `Hi ${b.userName},\n\nYour backup reservation on ${b.vmName} ends on ${formatDate(b.endDate)}. ` +
      `After that the system is purged and everything on it is deleted.\n\n` +
      `Please back up and save your data before then.\n\n${link('/app/bookings')}${signOff}`,
  }),
  userBackupReminderInApp: (b: Booking): InAppMessage => ({
    type: 'reminder',
    title: 'Back up your data',
    message: `${b.vmName} will be purged after ${formatDate(b.endDate)}. Save your data before then.`,
    link: '/app/bookings',
  }),

  userEndedInApp: (b: Booking): InAppMessage => ({
    type: 'ended',
    title: 'Booking ended',
    message: `Your booking on ${b.vmName} has ended and the system is being purged.`,
    link: '/app/bookings',
  }),

  // --- Accounts ------------------------------------------------------------

  accountCreated: (name: string, emailAddress: string, role: Role, tempPassword: string): EmailMessage => ({
    subject: `Your ${APP_NAME} account`,
    body:
      `Hi ${name},\n\nAn administrator created a ${ROLE_LABELS[role]} account for you.\n\n` +
      `Sign in: ${link('/login')}\nEmail: ${emailAddress}\nTemporary password: ${tempPassword}\n\n` +
      `You will be asked to choose a new password the first time you sign in.${signOff}`,
  }),

  passwordReset: (name: string, tempPassword: string): EmailMessage => ({
    subject: `Your ${APP_NAME} password was reset`,
    body:
      `Hi ${name},\n\nAn administrator reset your password.\n\nTemporary password: ${tempPassword}\n\n` +
      `You will be asked to choose a new password when you next sign in: ${link('/login')}${signOff}`,
  }),
};
