// Shapes of the data the API sends and receives. The server builds these
// objects and the website reads them, so both stay in sync.

import type { BookingAction, BookingStatus, BookingType, Program, Role, VmCategory, VmStatus } from './config';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  program: Program | null;
  studentId: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Vm {
  id: number;
  name: string;
  category: VmCategory;
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  os: string;
  software: string[];
  status: VmStatus;
  notes: string | null;
  // Filled in by the server from bookings.
  currentBooking: { id: number; status: BookingStatus; endDate: string; userName: string } | null;
  nextBooking: { id: number; startDate: string } | null;
}

export interface VmAvailability extends Vm {
  available: boolean;
  meetsRequirements: boolean;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  program: Program;
  lecturerId: number;
  lecturerName: string;
  semester: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
}

export interface Requirements {
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  software: string[];
}

export interface Booking {
  id: number;
  type: BookingType;
  status: BookingStatus;
  statusNote: string | null;
  category: VmCategory;
  userId: number;
  userName: string;
  userEmail: string;
  bookedById: number;
  bookedByName: string;
  vmId: number | null;
  vmName: string | null;
  courseId: number | null;
  courseCode: string | null;
  courseName: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  requirements: Requirements;
  purpose: string;
  notes: string | null;
  queuePosition: number | null;
  readyAt: string | null;
  reminderSentAt: string | null;
  purgeUntil: string | null;
  createdAt: string;
  updatedAt: string;
  // Status changes the signed-in user may make (see BOOKING_ACTIONS).
  actions?: BookingAction[];
}

export interface BookingEvent {
  id: number;
  bookingId: number;
  actorName: string | null;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  note: string | null;
  createdAt: string;
}

export interface NewBookingInput {
  type: BookingType;
  category?: VmCategory;
  courseId?: number;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  requirements: Requirements;
  purpose: string;
  notes?: string;
  vmId?: number;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface EmailLogEntry {
  id: number;
  to: string;
  subject: string;
  body: string;
  status: 'sent' | 'logged' | 'failed';
  error: string | null;
  createdAt: string;
}

export interface DashboardStats {
  myActive: number;
  myUpcoming: number;
  myQueued: number;
  pendingTasks: number;
  purgeTasks: number;
  queueLength: number;
  vmsTotal: number;
  vmsInUse: number;
  bookingsByCategory: { category: VmCategory; count: number }[];
  bookingsByStatus: { status: BookingStatus; count: number }[];
}

export interface AppMeta {
  demoMode: boolean;
  demoPassword: string | null;
  demoAccounts: { email: string; name: string; role: Role }[];
  emailDelivery: 'smtp' | 'log';
}
