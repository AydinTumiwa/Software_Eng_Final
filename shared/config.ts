// ---------------------------------------------------------------------------
// Central configuration for the AI Lab Booking System.
//
// Both the server (server/) and the website (src/) import this file, so a
// change here applies everywhere. When the client adds or changes a
// requirement, start by looking for the matching setting below.
// ---------------------------------------------------------------------------

export const APP_NAME = 'AI Lab Booking';
export const ORGANIZATION = 'Sampoerna University';

// --- Roles & permissions ---------------------------------------------------

export const ROLES = ['student', 'lecturer', 'lab_assistant', 'academic_registry', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  lecturer: 'Lecturer',
  lab_assistant: 'Lab Assistant',
  academic_registry: 'Academic Registry',
  admin: 'Administrator',
};

// Pages and API routes check these lists instead of hard-coding roles.
// To give a role access to a feature, add it to the matching list.
export const PERMISSIONS = {
  bookTeaching: ['lecturer', 'academic_registry', 'admin'],
  bookOnBehalf: ['academic_registry', 'admin'],
  bookBackup: ['student', 'lecturer'],
  manageSchedule: ['academic_registry', 'admin'],
  manageLabTasks: ['lab_assistant', 'admin'],
  manageVms: ['lab_assistant', 'admin'],
  manageUsers: ['admin'],
  viewAllBookings: ['lab_assistant', 'academic_registry', 'admin'],
  viewEmailLog: ['lab_assistant', 'admin'],
} satisfies Record<string, Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

// --- Academic programs & virtual machine categories ------------------------

export const PROGRAMS = ['IE', 'CS', 'IS'] as const;
export type Program = (typeof PROGRAMS)[number];

export const VM_CATEGORIES = ['IE', 'CS', 'IS', 'BACKUP'] as const;
export type VmCategory = (typeof VM_CATEGORIES)[number];

export const VM_CATEGORY_LABELS: Record<VmCategory, string> = {
  IE: 'Industrial Engineering',
  CS: 'Computer Science',
  IS: 'Information Systems',
  BACKUP: 'Backup',
};

// Operational state set by lab assistants. Whether a VM is in use on a given
// day is worked out from its bookings, not stored here.
export const VM_STATUSES = ['available', 'maintenance', 'retired'] as const;
export type VmStatus = (typeof VM_STATUSES)[number];

// Choices offered in the booking form when stating hardware requirements.
export const SPEC_OPTIONS = {
  cpuCores: [2, 4, 8, 16, 32],
  memoryGb: [4, 8, 16, 32, 64, 128],
  storageGb: [50, 100, 250, 500, 1000],
};

export const OS_OPTIONS = ['Ubuntu 24.04 LTS', 'Windows 11 Education', 'Windows Server 2025', 'Rocky Linux 9'];

export const SOFTWARE_CATALOG = [
  'Python 3',
  'Jupyter',
  'PyTorch',
  'TensorFlow',
  'CUDA Toolkit',
  'MATLAB',
  'R / RStudio',
  'Docker',
  'MySQL',
  'PostgreSQL',
  'Arena Simulation',
  'Minitab',
  'Visual Studio Code',
  'Java JDK',
  'Node.js',
  'Power BI',
];

// --- Booking rules ---------------------------------------------------------

export const BOOKING_TYPES = ['teaching', 'backup'] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  teaching: 'Teaching reservation',
  backup: 'Backup reservation',
};

export const BOOKING_RULES = {
  // Longest a backup reservation may run (client: 2-3 weeks max).
  backupMaxDays: 21,
  // How many days before a backup reservation ends the student is reminded
  // to back up and save their data.
  backupReminderDaysBeforeEnd: 3,
  // Days a VM is blocked after a booking ends so the lab assistant can purge
  // and reconfigure it (client: give 2 days).
  purgeDays: 2,
  // Minimum days between today and a booking's start date.
  minLeadDays: 0,
  // Longest a teaching reservation may run (about one semester).
  teachingMaxDays: 140,
  // How often the server checks for status changes, reminders and the queue.
  schedulerIntervalMinutes: 15,
};

export const BOOKING_STATUSES = [
  'queued',
  'pending',
  'configuring',
  'ready',
  'active',
  'purging',
  'completed',
  'rejected',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  queued: 'In queue',
  pending: 'Awaiting lab assistant',
  configuring: 'Being configured',
  ready: 'System ready',
  active: 'In use',
  purging: 'Purging',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const BOOKING_STATUS_DESCRIPTIONS: Record<BookingStatus, string> = {
  queued: 'Waiting for a backup VM to become free.',
  pending: 'The lab assistant has been emailed the schedule and requirements.',
  configuring: 'The lab assistant is setting up the virtual machine.',
  ready: 'The system is ready and will be available from the start date.',
  active: 'The booking period is running.',
  purging: `The booking has ended. The VM is being purged and reconfigured (${BOOKING_RULES.purgeDays} days).`,
  completed: 'The booking is finished and the VM has been reconfigured.',
  rejected: 'The request was rejected.',
  cancelled: 'The booking was cancelled.',
};

// Statuses that hold a VM. A new booking cannot overlap these (plus the
// purge buffer after each one).
export const BLOCKING_STATUSES: BookingStatus[] = ['pending', 'configuring', 'ready', 'active', 'purging'];

// Status changes people can make by hand. The server checks these, and the
// website uses them to decide which buttons to show. Automatic changes
// (ready → active → purging, queued → pending) are made by the scheduler.
export const BOOKING_ACTIONS = {
  startConfiguring: {
    label: 'Start configuring',
    from: ['pending'],
    to: 'configuring',
    roles: ['lab_assistant', 'admin'],
    allowOwner: false,
    requiresNote: false,
  },
  markReady: {
    label: 'Mark system ready',
    from: ['configuring'],
    to: 'ready',
    roles: ['lab_assistant', 'admin'],
    allowOwner: false,
    requiresNote: false,
  },
  reject: {
    label: 'Reject',
    from: ['queued', 'pending', 'configuring'],
    to: 'rejected',
    roles: ['lab_assistant', 'academic_registry', 'admin'],
    allowOwner: false,
    requiresNote: true,
  },
  completePurge: {
    label: 'Purge & reconfigure done',
    from: ['purging'],
    to: 'completed',
    roles: ['lab_assistant', 'admin'],
    allowOwner: false,
    requiresNote: false,
  },
  cancel: {
    label: 'Cancel booking',
    from: ['queued', 'pending', 'configuring', 'ready'],
    to: 'cancelled',
    roles: ['academic_registry', 'admin'],
    allowOwner: true,
    requiresNote: false,
  },
} satisfies Record<
  string,
  {
    label: string;
    from: BookingStatus[];
    to: BookingStatus;
    roles: Role[];
    allowOwner: boolean;
    requiresNote: boolean;
  }
>;
export type BookingAction = keyof typeof BOOKING_ACTIONS;

// --- Academic schedule -----------------------------------------------------

// 1 = Monday ... 7 = Sunday
export const DAYS_OF_WEEK: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

// --- Accounts --------------------------------------------------------------

export const PASSWORD_RULES = {
  minLength: 8,
  requireLetter: true,
  requireNumber: true,
};

// Returns a list of problems with a new password (empty when it is valid).
export function checkPassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_RULES.minLength) {
    problems.push(`Use at least ${PASSWORD_RULES.minLength} characters.`);
  }
  if (PASSWORD_RULES.requireLetter && !/[a-z]/i.test(password)) {
    problems.push('Include at least one letter.');
  }
  if (PASSWORD_RULES.requireNumber && !/\d/.test(password)) {
    problems.push('Include at least one number.');
  }
  return problems;
}
