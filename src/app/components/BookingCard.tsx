import { useState } from 'react';
import { BookOpen, CalendarDays, Clock, Cpu, HardDriveDownload, ListOrdered, Server, User } from 'lucide-react';
import { BOOKING_TYPE_LABELS, VM_CATEGORY_LABELS, BOOKING_RULES } from '@shared/config';
import { formatDate } from '@shared/dates';
import type { Booking } from '@shared/types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { StatusBadge } from './StatusBadge';
import { BookingActions } from './BookingActions';
import { BookingDetailSheet } from './BookingDetailSheet';
import { dateRange, specs } from '../utils/format';

export function BookingCard({
  booking,
  onChanged,
  showPerson = false,
}: {
  booking: Booking;
  onChanged: (b: Booking) => void;
  showPerson?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const b = booking;
  const TypeIcon = b.type === 'teaching' ? BookOpen : HardDriveDownload;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TypeIcon className="h-4 w-4" />
              {BOOKING_TYPE_LABELS[b.type]} · #{b.id}
            </div>
            <h3 className="font-semibold truncate">{b.courseCode ? `${b.courseCode} ${b.courseName}` : b.purpose}</h3>
          </div>
          <StatusBadge status={b.status} className="shrink-0" />
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <span className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            {b.vmName ?? 'Waiting for a VM'} <span className="text-muted-foreground">({VM_CATEGORY_LABELS[b.category]})</span>
          </span>
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {dateRange(b)}
          </span>
          {b.startTime && (
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Class {b.startTime}–{b.endTime}
            </span>
          )}
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            {specs(b.requirements)}
          </span>
          {showPerson && (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {b.userName}
              {b.bookedById !== b.userId && <span className="text-muted-foreground">(by {b.bookedByName})</span>}
            </span>
          )}
          {b.queuePosition && (
            <span className="flex items-center gap-2 font-medium">
              <ListOrdered className="h-4 w-4 text-muted-foreground" />
              Number {b.queuePosition} in the queue
            </span>
          )}
        </div>

        {b.status === 'purging' && b.purgeUntil && (
          <p className="text-sm rounded-md bg-orange-500/10 px-3 py-2">
            Purge & reconfigure by {formatDate(b.purgeUntil)} ({BOOKING_RULES.purgeDays}-day window).
          </p>
        )}
        {b.statusNote && (b.status === 'rejected' || b.status === 'cancelled') && (
          <p className="text-sm rounded-md bg-muted px-3 py-2">Reason: {b.statusNote}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="link" className="h-auto p-0" onClick={() => setOpen(true)}>
            View details & history
          </Button>
          <BookingActions booking={b} onChanged={onChanged} />
        </div>
      </CardContent>
      <BookingDetailSheet bookingId={open ? b.id : null} onClose={() => setOpen(false)} onChanged={onChanged} />
    </Card>
  );
}
