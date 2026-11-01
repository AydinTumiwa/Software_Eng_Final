import React from 'react';
import { useNavigate } from 'react-router';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, CalendarCheck, ClipboardList, HardDriveDownload, ListOrdered, Server, Trash2, Wrench } from 'lucide-react';
import { BOOKING_RULES, BOOKING_STATUS_LABELS, ROLE_LABELS, VM_CATEGORY_LABELS } from '@shared/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BookingCard } from '../components/BookingCard';
import { EmptyState, LoadState, PageHeader } from '../components/PageHeader';
import { useAuth, useUser } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

const OPEN_STATUSES = ['queued', 'pending', 'configuring', 'ready', 'active'];

function Stat({ label, value, icon, onClick }: { label: string; value: React.ReactNode; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <Card className={onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''} onClick={onClick}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useUser();
  const { can } = useAuth();
  const stats = useApi(() => api.dashboard());
  const mine = useApi(() => api.bookings.mine());
  const isStaff = can('viewAllBookings');

  const open = (mine.data ?? []).filter((b) => OPEN_STATUSES.includes(b.status));
  const s = stats.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${user.name}`}
        description={`Signed in as ${ROLE_LABELS[user.role]}`}
        actions={
          <>
            {can('bookTeaching') && (
              <Button onClick={() => navigate('/app/book?type=teaching')}>
                <BookOpen className="mr-2 h-4 w-4" /> Teaching reservation
              </Button>
            )}
            {can('bookBackup') && (
              <Button variant={can('bookTeaching') ? 'outline' : 'default'} onClick={() => navigate('/app/book?type=backup')}>
                <HardDriveDownload className="mr-2 h-4 w-4" /> Request backup VM
              </Button>
            )}
          </>
        }
      />

      <LoadState loading={stats.loading && !s} error={stats.error} />
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {can('manageLabTasks') ? (
            <>
              <Stat label="VMs to configure" value={s.pendingTasks} icon={<Wrench className="h-6 w-6" />} onClick={() => navigate('/app/lab-tasks')} />
              <Stat label="VMs to purge" value={s.purgeTasks} icon={<Trash2 className="h-6 w-6" />} onClick={() => navigate('/app/lab-tasks')} />
            </>
          ) : (
            <>
              <Stat label="My active bookings" value={s.myActive} icon={<CalendarCheck className="h-6 w-6" />} onClick={() => navigate('/app/bookings')} />
              <Stat label="My upcoming bookings" value={s.myUpcoming} icon={<ClipboardList className="h-6 w-6" />} onClick={() => navigate('/app/bookings')} />
            </>
          )}
          <Stat label="VMs in use today" value={`${s.vmsInUse} / ${s.vmsTotal}`} icon={<Server className="h-6 w-6" />} onClick={() => navigate('/app/resources')} />
          <Stat
            label={s.myQueued ? `Backup queue (you: ${s.myQueued})` : 'Backup queue'}
            value={s.queueLength}
            icon={<ListOrdered className="h-6 w-6" />}
            onClick={() => navigate('/app/queue')}
          />
        </div>
      )}

      {isStaff && s && s.bookingsByCategory.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bookings by category</CardTitle>
              <CardDescription>All time</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.bookingsByCategory.map((r) => ({ name: VM_CATEGORY_LABELS[r.category], count: r.count }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Bookings" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings by status</CardTitle>
              <CardDescription>All time</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={s.bookingsByStatus.map((r) => ({ name: BOOKING_STATUS_LABELS[r.status], count: r.count }))}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Bookings" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {(can('bookTeaching') || can('bookBackup') || open.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">My open bookings</h2>
            <Button variant="link" onClick={() => navigate('/app/bookings')}>
              See all
            </Button>
          </div>
          <LoadState loading={mine.loading && !mine.data} error={mine.error} />
          {mine.data && open.length === 0 && (
            <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="No open bookings">
              {can('bookBackup') &&
                `Backup VMs can be reserved for up to ${BOOKING_RULES.backupMaxDays} days, for example for your final year project.`}
            </EmptyState>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {open.slice(0, 4).map((b) => (
              <BookingCard key={b.id} booking={b} onChanged={() => mine.reload()} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
