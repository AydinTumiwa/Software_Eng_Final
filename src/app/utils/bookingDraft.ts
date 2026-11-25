// Keeps an unfinished booking while the person visits other pages, so the
// New booking form can pick up where they left off. Stored in this browser
// tab's sessionStorage: it survives page changes and refreshes, and is gone
// when the tab is closed, when the booking is submitted, or on sign-out.

import type { BookingType, VmCategory } from '@shared/config';
import type { Requirements } from '@shared/types';

export interface BookingDraft {
  type: BookingType;
  courseId: number | null;
  category: VmCategory;
  purpose: string;
  notes: string;
  requirements: Requirements;
  startDate: string | null;
  endDate: string | null;
  vmChoice: 'auto' | number;
  step: number;
}

const PREFIX = 'lab-booking-draft:';

// Storage can be unavailable (private mode, blocked site data); the form then
// simply works without drafts.
export function loadDraft(userId: number): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + userId);
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId: number, draft: BookingDraft) {
  try {
    sessionStorage.setItem(PREFIX + userId, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearDraft(userId: number) {
  try {
    sessionStorage.removeItem(PREFIX + userId);
  } catch {
    // ignore
  }
}

export function clearAllDrafts() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
