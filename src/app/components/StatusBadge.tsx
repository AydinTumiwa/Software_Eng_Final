import { Badge } from './ui/badge';
import { BOOKING_STATUS_DESCRIPTIONS, BOOKING_STATUS_LABELS, type BookingStatus, type VmStatus } from '@shared/config';

// Colours per status. Labels come from shared/config.ts.
const BOOKING_COLORS: Record<BookingStatus, string> = {
  queued: 'bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-300',
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300',
  configuring: 'bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300',
  ready: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300',
  active: 'bg-blue-600/10 text-blue-700 border-blue-600/20 dark:text-blue-300',
  purging: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300',
  completed: 'bg-muted text-muted-foreground border-border',
  rejected: 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({ status, className = '' }: { status: BookingStatus; className?: string }) {
  return (
    <Badge variant="outline" className={`${BOOKING_COLORS[status]} ${className}`} title={BOOKING_STATUS_DESCRIPTIONS[status]}>
      {BOOKING_STATUS_LABELS[status]}
    </Badge>
  );
}

const VM_COLORS: Record<VmStatus, string> = {
  available: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300',
  maintenance: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300',
  retired: 'bg-muted text-muted-foreground border-border',
};

export function VmStatusBadge({ status }: { status: VmStatus }) {
  return (
    <Badge variant="outline" className={`${VM_COLORS[status]} capitalize`}>
      {status}
    </Badge>
  );
}
