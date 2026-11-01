import React, { useEffect, useState } from 'react';
import { BOOKING_STATUS_DESCRIPTIONS, BOOKING_STATUS_LABELS, BOOKING_TYPE_LABELS, VM_CATEGORY_LABELS } from '@shared/config';
import { formatDate } from '@shared/dates';
import type { Booking, BookingEvent } from '@shared/types';
import { api } from '../api/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Badge } from './ui/badge';
import { StatusBadge } from './StatusBadge';
import { BookingActions } from './BookingActions';
import { dateRange, formatTimestamp } from '../utils/format';

type Detail = Booking & { events: BookingEvent[] };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

export function BookingDetailSheet({
  bookingId,
  onClose,
  onChanged,
}: {
  bookingId: number | null;
  onClose: () => void;
  onChanged: (b: Booking) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = (id: number) => api.bookings.get(id).then(setDetail).catch(() => setDetail(null));
  useEffect(() => {
    setDetail(null);
    if (bookingId) load(bookingId);
  }, [bookingId]);

  const b = detail;
  return (
    <Sheet open={bookingId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Booking #{bookingId}</SheetTitle>
          <SheetDescription>{b ? BOOKING_STATUS_DESCRIPTIONS[b.status] : 'Loading…'}</SheetDescription>
        </SheetHeader>
        {b && (
          <div className="space-y-6 px-4 pb-6">
            <div className="flex items-center gap-2">
              <StatusBadge status={b.status} />
              <Badge variant="outline">{BOOKING_TYPE_LABELS[b.type]}</Badge>
            </div>

            <section className="space-y-2">
              <Row label="For">{b.userName} ({b.userEmail})</Row>
              {b.bookedById !== b.userId && <Row label="Requested by">{b.bookedByName}</Row>}
              {b.courseCode && <Row label="Course">{b.courseCode} {b.courseName}</Row>}
              <Row label="Purpose">{b.purpose}</Row>
              <Row label="Category">{VM_CATEGORY_LABELS[b.category]}</Row>
              <Row label="Virtual machine">{b.vmName ?? `Queued (number ${b.queuePosition})`}</Row>
              <Row label="Dates">{dateRange(b)}</Row>
              {b.startTime && <Row label="Class time">{b.startTime}–{b.endTime}</Row>}
              {b.purgeUntil && <Row label="Purge until">{formatDate(b.purgeUntil)}</Row>}
              {b.statusNote && <Row label="Note">{b.statusNote}</Row>}
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-base">Requirements</h3>
              <Row label="CPU">{b.requirements.cpuCores} cores</Row>
              <Row label="Memory">{b.requirements.memoryGb} GB</Row>
              <Row label="Storage">{b.requirements.storageGb} GB</Row>
              <Row label="Software">
                {b.requirements.software.length ? (
                  <span className="flex flex-wrap gap-1">
                    {b.requirements.software.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </span>
                ) : (
                  'None specified'
                )}
              </Row>
              {b.notes && <Row label="Notes">{b.notes}</Row>}
            </section>

            <section>
              <h3 className="font-semibold text-base mb-3">History</h3>
              <ol className="relative border-l pl-5 space-y-4">
                {b.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-background" />
                    <p className="font-medium">{BOOKING_STATUS_LABELS[e.toStatus]}</p>
                    <p className="text-muted-foreground">
                      {formatTimestamp(e.createdAt)} · {e.actorName ?? 'System'}
                    </p>
                    {e.note && <p className="mt-1">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </section>

            <BookingActions
              booking={b}
              size="default"
              onChanged={(updated) => {
                onChanged(updated);
                load(updated.id);
              }}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
