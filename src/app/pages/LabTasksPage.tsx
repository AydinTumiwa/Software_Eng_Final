import { CheckCircle2, Hammer, Inbox, Trash2 } from 'lucide-react';
import { BOOKING_RULES } from '@shared/config';
import type { Booking } from '@shared/types';
import { BookingCard } from '../components/BookingCard';
import { EmptyState, LoadState, PageHeader } from '../components/PageHeader';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

// The lab assistant's to-do list: configure new bookings and mark them ready
// (which notifies the user), and purge VMs after bookings end.
export function LabTasksPage() {
  const { data, loading, error, reload } = useApi(() => api.bookings.all({ status: 'pending,configuring,purging' }));
  const list = data ?? [];
  const byStart = (a: Booking, b: Booking) => a.startDate.localeCompare(b.startDate);

  const sections = [
    {
      title: 'New requests',
      description: 'Check the schedule and requirements, then start configuring the VM.',
      icon: <Inbox className="h-5 w-5" />,
      items: list.filter((b) => b.status === 'pending').sort(byStart),
    },
    {
      title: 'Being configured',
      description: 'Mark the system ready when it is set up. The user is emailed straight away.',
      icon: <Hammer className="h-5 w-5" />,
      items: list.filter((b) => b.status === 'configuring').sort(byStart),
    },
    {
      title: 'Purge & reconfigure',
      description: `Bookings that have ended. Purge the VM and reconfigure it within ${BOOKING_RULES.purgeDays} days.`,
      icon: <Trash2 className="h-5 w-5" />,
      items: list.filter((b) => b.status === 'purging').sort((a, b) => (a.purgeUntil ?? '').localeCompare(b.purgeUntil ?? '')),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Lab tasks" description="Virtual machines that need your attention." />
      <LoadState loading={loading && !data} error={error} />
      {data &&
        sections.map((s) => (
          <section key={s.title} className="space-y-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                {s.icon} {s.title} <span className="text-muted-foreground font-normal">({s.items.length})</span>
              </h2>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
            {s.items.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="All done" />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {s.items.map((b) => (
                  <BookingCard key={b.id} booking={b} onChanged={() => reload()} showPerson />
                ))}
              </div>
            )}
          </section>
        ))}
    </div>
  );
}
