import { useNavigate } from 'react-router';
import { HardDriveDownload, ListOrdered } from 'lucide-react';
import { BOOKING_RULES } from '@shared/config';
import { formatDate } from '@shared/dates';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { BookingActions } from '../components/BookingActions';
import { EmptyState, LoadState, PageHeader } from '../components/PageHeader';
import { useAuth, useUser } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { dateRange, formatTimestamp, specs } from '../utils/format';

// Backup requests waiting for a free backup VM, first come first served. The
// server re-checks the queue whenever a VM is released and on a timer.
export function QueuePage() {
  const navigate = useNavigate();
  const user = useUser();
  const { can } = useAuth();
  const queue = useApi(() => api.bookings.queue());
  const backupVms = useApi(() => api.vms.list('BACKUP'));

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Backup queue"
        description={`When every backup VM is taken, requests wait here in order. When one frees up (after its ${BOOKING_RULES.purgeDays}-day purge), the next request that fits is assigned and emailed.`}
        actions={
          can('bookBackup') && (
            <Button onClick={() => navigate('/app/book?type=backup')}>
              <HardDriveDownload className="mr-2 h-4 w-4" /> Request backup VM
            </Button>
          )
        }
      />

      {backupVms.data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {backupVms.data.map((vm) => (
            <Card key={vm.id}>
              <CardContent className="p-4">
                <p className="font-medium">{vm.name}</p>
                <p className="text-sm text-muted-foreground">
                  {vm.status !== 'available'
                    ? `Out of service (${vm.status})`
                    : vm.currentBooking
                      ? vm.currentBooking.status === 'purging'
                        ? 'Being purged'
                        : `In use until ${formatDate(vm.currentBooking.endDate)}`
                      : vm.nextBooking
                        ? `Free until ${formatDate(vm.nextBooking.startDate)}`
                        : 'Free'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LoadState loading={queue.loading && !queue.data} error={queue.error} />
      {queue.data?.length === 0 && (
        <EmptyState icon={<ListOrdered className="h-10 w-10" />} title="The queue is empty">
          Backup requests go straight to a free VM when one is available.
        </EmptyState>
      )}
      <ol className="space-y-3">
        {queue.data?.map((b) => {
          const mine = b.userId === user.id;
          return (
            <li key={b.id}>
              <Card className={mine ? 'border-primary' : ''}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                    {b.queuePosition}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-medium">
                      {b.userName} {mine && <Badge className="ml-1">You</Badge>}
                    </p>
                    {b.purpose && <p className="text-muted-foreground truncate">{b.purpose}</p>}
                    <p className="text-muted-foreground">
                      Wants {dateRange(b)} · {specs(b.requirements)} · requested {formatTimestamp(b.createdAt)}
                    </p>
                  </div>
                  <BookingActions booking={b} onChanged={() => queue.reload()} />
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
