import { useState } from 'react';
import { Search } from 'lucide-react';
import { BOOKING_STATUSES, BOOKING_STATUS_LABELS, BOOKING_TYPES, BOOKING_TYPE_LABELS } from '@shared/config';
import type { Booking } from '@shared/types';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Card } from '../components/ui/card';
import { StatusBadge } from '../components/StatusBadge';
import { BookingDetailSheet } from '../components/BookingDetailSheet';
import { LoadState, PageHeader } from '../components/PageHeader';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { dateRange } from '../utils/format';

export function AllBookingsPage() {
  const { data, loading, error, reload } = useApi(() => api.bookings.all());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [openId, setOpenId] = useState<number | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = (data ?? []).filter(
    (b: Booking) =>
      (status === 'all' || b.status === status) &&
      (type === 'all' || b.type === type) &&
      (!q || [b.userName, b.vmName, b.courseCode, b.courseName, b.purpose, `#${b.id}`].some((v) => v?.toLowerCase().includes(q))),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="All bookings" description="Every reservation in the system. Click a row for details and actions." />
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by person, VM, course or #id" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BOOKING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {BOOKING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="md:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {BOOKING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {BOOKING_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <LoadState loading={loading && !data} error={error} />
      {data && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Type / course</TableHead>
                <TableHead>VM</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setOpenId(b.id)}>
                  <TableCell>{b.id}</TableCell>
                  <TableCell>{b.userName}</TableCell>
                  <TableCell>{b.courseCode ?? BOOKING_TYPE_LABELS[b.type]}</TableCell>
                  <TableCell>{b.vmName ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{dateRange(b)}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No bookings match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
      <BookingDetailSheet bookingId={openId} onClose={() => setOpenId(null)} onChanged={() => reload()} />
    </div>
  );
}
