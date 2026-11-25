import { useState, type ReactNode } from 'react';
import { Download, Printer, Star, TrendingUp } from 'lucide-react';
import { APP_NAME, BOOKING_TYPE_LABELS, VM_CATEGORY_LABELS } from '@shared/config';
import { formatDate, parseISODate, todayISO } from '@shared/dates';
import type { MonthlyReport } from '@shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { LoadState, PageHeader } from '../components/PageHeader';
import { useUser } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const monthName = (m: string) => parseISODate(`${m}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function Bar({ value, max, className = 'bg-primary' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full rounded-full bg-muted">
      {value > 0 && <div className={`h-2.5 rounded-full ${className}`} style={{ width: `${pct}%` }} />}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="break-inside-avoid">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function downloadCsv(r: MonthlyReport) {
  const rows: (string | number)[][] = [
    [`${APP_NAME} monthly report`, r.label],
    [],
    ['Summary', 'Value'],
    ['Booking requests', r.totals.requests],
    ['Bookings using a VM', r.totals.bookingsInUse],
    ['VM-days booked', r.totals.bookedDays],
    ['Utilisation (%)', r.totals.utilisation],
    ['Joined backup queue', r.totals.queueJoins],
    ['Rejected', r.totals.rejected],
    ['Cancelled', r.totals.cancelled],
    ['Ended early', r.totals.endedEarly],
    [],
    ['VM', 'Category', 'Bookings', 'Days booked', 'Utilisation (%)'],
    ...r.byVm.map((v) => [v.name, VM_CATEGORY_LABELS[v.category], v.bookings, v.bookedDays, v.utilisation]),
    [],
    ['Category', 'Requests', 'Days booked'],
    ...r.byCategory.map((c) => [VM_CATEGORY_LABELS[c.category], c.requests, c.bookedDays]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lab-booking-report-${r.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Monthly statistics for staff, with printing and CSV export.
export function ReportsPage() {
  const user = useUser();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const { data: r, loading, error } = useApi(() => api.reports.monthly(month), [month]);

  const maxVmDays = Math.max(0, ...(r?.byVm.map((v) => v.bookedDays) ?? []));
  const maxCatRequests = Math.max(0, ...(r?.byCategory.map((c) => c.requests) ?? []));
  const maxDaily = Math.max(1, r?.totals.vmsCounted ?? 1);
  const maxTrend = Math.max(0, ...(r?.trend.map((t) => t.bookedDays) ?? []));

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Monthly booking statistics: demand, the most booked VMs, and how full the lab was."
          actions={
            <>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(r?.availableMonths ?? [month]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={!r} onClick={() => r && downloadCsv(r)}>
                <Download className="mr-2 h-4 w-4" /> Download CSV
              </Button>
              <Button disabled={!r} onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print report
              </Button>
            </>
          }
        />
      </div>

      {/* Only on paper */}
      {r && (
        <div className="hidden print:block border-b pb-3">
          <h1 className="text-2xl font-bold">
            {APP_NAME} – Monthly report: {r.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(r.startDate)} – {formatDate(r.endDate)} · Printed {formatDate(todayISO())} by {user.name}
          </p>
        </div>
      )}

      <LoadState loading={loading && !r} error={error} />
      {r && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
            <Kpi label="Booking requests" value={r.totals.requests} hint="made this month" />
            <Kpi label="VM-days booked" value={r.totals.bookedDays} hint={`across ${r.totals.vmsCounted} VMs`} />
            <Kpi label="Utilisation" value={`${r.totals.utilisation}%`} hint="of all VM-days" />
            <Kpi label="Bookings using a VM" value={r.totals.bookingsInUse} />
            <Kpi label="Joined backup queue" value={r.totals.queueJoins} />
            <Kpi
              label="Ended early / cancelled / rejected"
              value={`${r.totals.endedEarly} / ${r.totals.cancelled} / ${r.totals.rejected}`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <Card className="break-inside-avoid">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-full bg-amber-500/15 p-3 text-amber-600">
                  <Star className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Most booked VM</p>
                  <p className="text-xl font-semibold">{r.mostBookedVm ? r.mostBookedVm.name : 'No bookings'}</p>
                  {r.mostBookedVm && (
                    <p className="text-sm text-muted-foreground">
                      {r.mostBookedVm.bookedDays} of {r.daysInMonth} days booked
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="break-inside-avoid">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-full bg-primary/10 p-3 text-primary">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Most requested category</p>
                  <p className="text-xl font-semibold">
                    {r.mostRequestedCategory ? VM_CATEGORY_LABELS[r.mostRequestedCategory.category] : 'No requests'}
                  </p>
                  {r.mostRequestedCategory && (
                    <p className="text-sm text-muted-foreground">
                      {plural(r.mostRequestedCategory.requests, 'request')} ·{' '}
                      {r.byType.map((t) => `${t.requests} ${BOOKING_TYPE_LABELS[t.type].split(' ')[0].toLowerCase()}`).join(' and ')} requests this month
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="break-inside-avoid">
            <CardHeader>
              <CardTitle>Usage by virtual machine</CardTitle>
              <CardDescription>Days each VM was booked in {r.label}, most booked first.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VM</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="w-[35%]">Utilisation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.byVm.map((v) => (
                    <TableRow key={v.vmId}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell>{VM_CATEGORY_LABELS[v.category]}</TableCell>
                      <TableCell className="text-right">{v.bookings}</TableCell>
                      <TableCell className="text-right">{v.bookedDays}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bar value={v.bookedDays} max={maxVmDays} />
                          <span className="w-10 text-right text-sm text-muted-foreground">{v.utilisation}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>Demand by category</CardTitle>
                <CardDescription>Requests made and days booked in {r.label}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.byCategory.map((c) => (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{VM_CATEGORY_LABELS[c.category]}</span>
                      <span className="text-muted-foreground">
                        {plural(c.requests, 'request')} · {plural(c.bookedDays, 'day')}
                      </span>
                    </div>
                    <Bar value={c.requests} max={maxCatRequests} className="bg-violet-500" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>Last 6 months</CardTitle>
                <CardDescription>VM-days booked per month.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.trend.map((t) => (
                  <div key={t.month} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={t.month === r.month ? 'font-semibold' : ''}>{t.label}</span>
                      <span className="text-muted-foreground">
                        {plural(t.bookedDays, 'day')} · {plural(t.requests, 'request')}
                      </span>
                    </div>
                    <Bar value={t.bookedDays} max={maxTrend} className={t.month === r.month ? 'bg-primary' : 'bg-primary/40'} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="break-inside-avoid">
            <CardHeader>
              <CardTitle>VMs in use each day</CardTitle>
              <CardDescription>Out of {r.totals.vmsCounted} VMs. The busiest days show the peak demand.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-[2px]">
                {r.dailyInUse.map((d) => (
                  <div
                    key={d.date}
                    title={`${formatDate(d.date)}: ${d.inUse} VMs`}
                    className="flex-1 rounded-t bg-emerald-500/80"
                    style={{ height: `${Math.max(2, (d.inUse / maxDaily) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{formatDate(r.startDate)}</span>
                <span>{formatDate(r.endDate)}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
