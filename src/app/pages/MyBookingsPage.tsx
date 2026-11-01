import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarPlus, ClipboardList } from 'lucide-react';
import type { BookingStatus } from '@shared/config';
import type { Booking } from '@shared/types';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BookingCard } from '../components/BookingCard';
import { EmptyState, LoadState, PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

const TABS: { key: string; label: string; statuses: BookingStatus[] }[] = [
  { key: 'current', label: 'Current & upcoming', statuses: ['pending', 'configuring', 'ready', 'active'] },
  { key: 'queue', label: 'In queue', statuses: ['queued'] },
  { key: 'past', label: 'Past', statuses: ['purging', 'completed', 'rejected', 'cancelled'] },
];

export function MyBookingsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data, loading, error, setData } = useApi(() => api.bookings.mine());
  const [tab, setTab] = useState('current');

  const replace = (updated: Booking) => setData((list) => list?.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)) ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My bookings"
        description="Bookings you made or that were made for you."
        actions={
          (can('bookTeaching') || can('bookBackup')) && (
            <Button onClick={() => navigate('/app/book')}>
              <CalendarPlus className="mr-2 h-4 w-4" /> New booking
            </Button>
          )
        }
      />
      <LoadState loading={loading && !data} error={error} />
      {data && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label} ({data.filter((b) => t.statuses.includes(b.status)).length})
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => {
            const list = data.filter((b) => t.statuses.includes(b.status));
            return (
              <TabsContent key={t.key} value={t.key} className="mt-4">
                {list.length === 0 ? (
                  <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="Nothing here yet" />
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {list.map((b) => (
                      <BookingCard key={b.id} booking={b} onChanged={replace} showPerson={b.userId !== b.bookedById} />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
