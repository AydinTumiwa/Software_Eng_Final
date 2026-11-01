// Every call the website makes to the server goes through this file. To add
// an endpoint, add a server route in server/routes and a function here.

import type { BookingAction, VmCategory } from '@shared/config';
import type {
  AppMeta,
  Booking,
  BookingEvent,
  Course,
  DashboardStats,
  EmailLogEntry,
  NewBookingInput,
  Notification,
  User,
  Vm,
  VmAvailability,
} from '@shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

// Called when the server says the session is missing or a password change is
// required, so the app can redirect. Set by AuthProvider.
let onAuthProblem: ((code: string) => void) | null = null;
export function setAuthProblemHandler(handler: typeof onAuthProblem) {
  onAuthProblem = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new ApiError(response.status, data.error ?? `Request failed (${response.status})`, data.code);
    if (error.code === 'UNAUTHENTICATED' || error.code === 'PASSWORD_CHANGE_REQUIRED') onAuthProblem?.(error.code);
    throw error;
  }
  return data as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body);
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
const del = <T>(path: string) => request<T>('DELETE', path);

function query(params: Record<string, string | number | undefined>) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}

export const api = {
  meta: () => get<AppMeta>('/meta'),

  auth: {
    login: (email: string, password: string) => post<User>('/auth/login', { email, password }),
    logout: () => post('/auth/logout'),
    me: () => get<User>('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      post<User>('/auth/change-password', { currentPassword, newPassword }),
  },

  vms: {
    list: (category?: VmCategory) => get<Vm[]>(`/vms${query({ category })}`),
    availability: (p: { category: VmCategory; startDate: string; endDate: string; cpuCores: number; memoryGb: number; storageGb: number }) =>
      get<VmAvailability[]>(`/vms/availability${query(p)}`),
    blocked: (id: number) => get<{ start: string; end: string }[]>(`/vms/${id}/blocked`),
    create: (vm: Partial<Vm>) => post<Vm>('/vms', vm),
    update: (id: number, vm: Partial<Vm>) => put<Vm>(`/vms/${id}`, vm),
    remove: (id: number) => del(`/vms/${id}`),
  },

  courses: {
    list: (mine = false) => get<Course[]>(`/courses${mine ? '?mine=1' : ''}`),
    lecturers: () => get<User[]>('/courses/lecturers'),
    create: (c: Omit<Course, 'id' | 'lecturerName'>) => post<Course>('/courses', c),
    update: (id: number, c: Omit<Course, 'id' | 'lecturerName'>) => put<Course>(`/courses/${id}`, c),
    remove: (id: number) => del(`/courses/${id}`),
  },

  bookings: {
    mine: () => get<Booking[]>('/bookings'),
    all: (p: { status?: string; type?: string } = {}) => get<Booking[]>(`/bookings${query({ scope: 'all', ...p })}`),
    queue: () => get<Booking[]>('/bookings/queue'),
    get: (id: number) => get<Booking & { events: BookingEvent[] }>(`/bookings/${id}`),
    create: (input: NewBookingInput) => post<Booking>('/bookings', input),
    act: (id: number, action: BookingAction, note?: string) => post<Booking>(`/bookings/${id}/actions/${action}`, { note }),
  },

  users: {
    list: () => get<User[]>('/users'),
    create: (u: Partial<User> & { password?: string }) => post<{ user: User; temporaryPassword: string }>('/users', u),
    update: (id: number, u: Partial<User>) => patch<User>(`/users/${id}`, u),
    resetPassword: (id: number) => post<{ temporaryPassword: string }>(`/users/${id}/reset-password`),
  },

  notifications: {
    list: () => get<Notification[]>('/notifications'),
    markRead: (id?: number) => post('/notifications/read', { id }),
  },

  emails: () => get<EmailLogEntry[]>('/emails'),
  dashboard: () => get<DashboardStats>('/stats/dashboard'),
};
