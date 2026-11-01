// Sidebar and mobile menu entries. An item with a `permission` only shows
// for roles that have it, or any one of them when it is a list (see
// PERMISSIONS in shared/config.ts). To add a page: create it in pages/, add
// its route in routes.tsx, and list it here.

import {
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  ListOrdered,
  Mail,
  Server,
  Table2,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@shared/config';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: Permission | Permission[];
  // Show in the bottom bar on phones (at most 4 are shown).
  mobile?: boolean;
}

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, mobile: true },
      { label: 'New booking', path: '/app/book', icon: CalendarPlus, permission: ['bookTeaching', 'bookBackup'], mobile: true },
      { label: 'My bookings', path: '/app/bookings', icon: ClipboardList, mobile: true },
      { label: 'Backup queue', path: '/app/queue', icon: ListOrdered },
      { label: 'Academic schedule', path: '/app/schedule', icon: CalendarClock },
      { label: 'Lab resources', path: '/app/resources', icon: Server },
    ],
  },
  {
    title: 'Lab management',
    items: [
      { label: 'Lab tasks', path: '/app/lab-tasks', icon: Wrench, permission: 'manageLabTasks', mobile: true },
      { label: 'All bookings', path: '/app/all-bookings', icon: Table2, permission: 'viewAllBookings' },
      { label: 'Users', path: '/app/users', icon: Users, permission: 'manageUsers' },
      { label: 'Email log', path: '/app/emails', icon: Mail, permission: 'viewEmailLog' },
    ],
  },
];

export function isVisible(item: NavItem, can: (p: Permission) => boolean): boolean {
  if (!item.permission) return true;
  return (Array.isArray(item.permission) ? item.permission : [item.permission]).some(can);
}
