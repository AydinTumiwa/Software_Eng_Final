import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import { AlertTriangle, BookOpen, Check, HardDriveDownload, ListOrdered } from 'lucide-react';
import {
  BOOKING_RULES,
  BOOKING_TYPE_LABELS,
  DAYS_OF_WEEK,
  SOFTWARE_CATALOG,
  SPEC_OPTIONS,
  VM_CATEGORIES,
  VM_CATEGORY_LABELS,
  type BookingType,
  type VmCategory,
} from '@shared/config';
import { addDays, daysInclusive, formatDate, parseISODate, toISODate, todayISO } from '@shared/dates';
import type { Requirements, VmAvailability } from '@shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Calendar } from '../components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { specs } from '../utils/format';

const STEPS = ['Details', 'Requirements', 'Dates & VM', 'Review'];
const DEFAULT_REQUIREMENTS: Requirements = { cpuCores: 4, memoryGb: 8, storageGb: 100, software: [] };

function SpecSelect({ label, value, options, unit, onChange }: { label: string; value: number; options: number[]; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={String(o)}>
              {o} {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NewBookingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { can } = useAuth();
  const allowedTypes = (['teaching', 'backup'] as BookingType[]).filter((t) => can(t === 'teaching' ? 'bookTeaching' : 'bookBackup'));
  const initialType = allowedTypes.find((t) => t === params.get('type')) ?? allowedTypes[0];

  const [step, setStep] = useState(0);
  const [type, setType] = useState<BookingType | undefined>(initialType);
  const [courseId, setCourseId] = useState<number | null>(params.get('course') ? Number(params.get('course')) : null);
  const [category, setCategory] = useState<VmCategory>('BACKUP');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [req, setReq] = useState<Requirements>(DEFAULT_REQUIREMENTS);
  const [range, setRange] = useState<DateRange | undefined>();
  const [vmChoice, setVmChoice] = useState<'auto' | number>('auto');
  const [availability, setAvailability] = useState<VmAvailability[] | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const courses = useApi(() => (can('bookTeaching') ? api.courses.list(!can('bookOnBehalf')) : Promise.resolve([])));
  const course = courses.data?.find((c) => c.id === courseId);

  const isTeaching = type === 'teaching';
  const maxDays = isTeaching ? BOOKING_RULES.teachingMaxDays : BOOKING_RULES.backupMaxDays;
  const earliest = addDays(todayISO(), BOOKING_RULES.minLeadDays);
  const startDate = range?.from ? toISODate(range.from) : null;
  const endDate = range?.to ? toISODate(range.to) : null;

  // Pick sensible defaults when the type or course changes.
  useEffect(() => {
    if (!isTeaching) {
      setCategory('BACKUP');
    } else if (course) {
      setCategory(course.program);
      setPurpose(`${course.code} ${course.name} practical sessions`);
    }
    setRange(undefined);
    setVmChoice('auto');
  }, [type, courseId, course?.id]);

  // Check which VMs are free once the dates are picked.
  useEffect(() => {
    setAvailability(null);
    setVmChoice('auto');
    if (!startDate || !endDate) return;
    api.vms
      .availability({ category, startDate, endDate, cpuCores: req.cpuCores, memoryGb: req.memoryGb, storageGb: req.storageGb })
      .then(setAvailability)
      .catch((e) => toast.error(e.message));
    if (!isTeaching) api.bookings.queue().then((q) => setQueueLength(q.length)).catch(() => undefined);
  }, [startDate, endDate, category, req.cpuCores, req.memoryGb, req.storageGb]);

  const suitable = useMemo(() => (availability ?? []).filter((v) => v.available && v.meetsRequirements), [availability]);
  const chosenVm = vmChoice === 'auto' ? suitable[0] : availability?.find((v) => v.id === vmChoice);
  const willQueue = !isTeaching && availability !== null && suitable.length === 0;

  const useCourseDates = () => {
    if (!course) return;
    const from = course.startDate < earliest ? earliest : course.startDate;
    const to = course.endDate < from ? from : course.endDate;
    const capped = daysInclusive(from, to) > maxDays ? addDays(from, maxDays - 1) : to;
    setRange({ from: parseISODate(from), to: parseISODate(capped) });
  };

  const disabledDays = [
    { before: parseISODate(earliest) },
    ...(range?.from && !range.to ? [{ after: parseISODate(addDays(toISODate(range.from), maxDays - 1)) }] : []),
  ];

  const stepValid = [
    !!type && purpose.trim().length > 0 && (!isTeaching || !!course),
    req.cpuCores > 0 && req.memoryGb > 0 && req.storageGb > 0,
    !!startDate && !!endDate && availability !== null && (willQueue || !!chosenVm),
    true,
  ];

  const submit = async () => {
    if (!type || !startDate || !endDate) return;
    setSubmitting(true);
    try {
      const booking = await api.bookings.create({
        type,
        courseId: course?.id,
        category,
        startDate,
        endDate,
        requirements: req,
        purpose: purpose.trim(),
        notes: notes.trim() || undefined,
        vmId: vmChoice === 'auto' ? undefined : vmChoice,
      });
      if (booking.status === 'queued') {
        toast.success(`Added to the backup queue (number ${booking.queuePosition})`);
        navigate('/app/queue');
      } else {
        toast.success(`Booking #${booking.id} sent to the lab assistant`, { description: `${booking.vmName} reserved.` });
        navigate('/app/bookings');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!type) {
    return <PageHeader title="New booking" description="Your role cannot make bookings." />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="New booking"
        description={isTeaching ? 'Reserve a virtual machine for a course on the academic schedule.' : 'Reserve a backup VM, for example for your final year project.'}
      />

      {/* Steps */}
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-col gap-2">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            <span className={`text-xs sm:text-sm ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What do you need?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {allowedTypes.length > 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {allowedTypes.map((t) => {
                  const Icon = t === 'teaching' ? BookOpen : HardDriveDownload;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`rounded-xl border p-4 text-left transition-colors ${type === t ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                    >
                      <Icon className="h-5 w-5 text-primary mb-2" />
                      <p className="font-medium">{BOOKING_TYPE_LABELS[t]}</p>
                      <p className="text-sm text-muted-foreground">
                        {t === 'teaching' ? 'VM for a course you teach, based on the academic schedule.' : `Up to ${BOOKING_RULES.backupMaxDays} days, e.g. for FYP data.`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {isTeaching ? (
              <>
                <div className="space-y-2">
                  <Label>Course (from the academic schedule)</Label>
                  <Select value={courseId ? String(courseId) : ''} onValueChange={(v) => setCourseId(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder={courses.loading ? 'Loading courses…' : 'Choose a course'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(courses.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.code} {c.name} · {c.lecturerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {courses.data?.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      You have no courses on the schedule yet. The Academic Registry adds them on the Academic schedule page.
                    </p>
                  )}
                  {course && (
                    <p className="text-sm text-muted-foreground">
                      {DAYS_OF_WEEK[course.dayOfWeek]}s {course.startTime}–{course.endTime} · {course.semester}: {formatDate(course.startDate)} –{' '}
                      {formatDate(course.endDate)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>VM category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as VmCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VM_CATEGORIES.filter((c) => c !== 'BACKUP').map((c) => (
                        <SelectItem key={c} value={c}>
                          {VM_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-muted p-3 text-sm">
                Backup reservations last at most <strong>{BOOKING_RULES.backupMaxDays} days</strong>. You'll get an email{' '}
                {BOOKING_RULES.backupReminderDaysBeforeEnd} days before the end to back up your data. After that the VM is purged. If no
                backup VM is free, you join the queue.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Input
                id="purpose"
                value={purpose}
                maxLength={300}
                placeholder={isTeaching ? 'e.g. Weekly practical sessions' : 'e.g. Final year project – training data'}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
            <CardDescription>
              Only VMs with at least this much CPU, memory and storage can be booked. The lab assistant installs the software you pick.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <SpecSelect label="CPU" unit="cores" value={req.cpuCores} options={SPEC_OPTIONS.cpuCores} onChange={(v) => setReq({ ...req, cpuCores: v })} />
              <SpecSelect label="Memory" unit="GB" value={req.memoryGb} options={SPEC_OPTIONS.memoryGb} onChange={(v) => setReq({ ...req, memoryGb: v })} />
              <SpecSelect label="Storage" unit="GB" value={req.storageGb} options={SPEC_OPTIONS.storageGb} onChange={(v) => setReq({ ...req, storageGb: v })} />
            </div>
            <div className="space-y-2">
              <Label>Software</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SOFTWARE_CATALOG.map((s) => (
                  <label key={s} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                    <Checkbox
                      checked={req.software.includes(s)}
                      onCheckedChange={(checked) =>
                        setReq({ ...req, software: checked ? [...req.software, s] : req.software.filter((x) => x !== s) })
                      }
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes for the lab assistant (optional)</Label>
              <Textarea id="notes" rows={3} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Specific versions, extra packages, access needs…" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Pick the start and end date</CardTitle>
            <CardDescription>
              Click the first day, then the last day. {isTeaching ? 'Teaching reservations' : 'Backup reservations'} can last up to {maxDays} days. Each VM
              is unavailable for {BOOKING_RULES.purgeDays} days after a booking while it is purged and reconfigured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isTeaching && course && (
              <Button variant="outline" size="sm" onClick={useCourseDates}>
                Use the course dates ({formatDate(course.startDate)} – {formatDate(course.endDate)})
              </Button>
            )}
            <div className="flex flex-col gap-6 xl:flex-row">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                disabled={disabledDays}
                numberOfMonths={2}
                defaultMonth={range?.from ?? parseISODate(earliest)}
                className="rounded-md border self-start"
              />
              <div className="flex-1 space-y-3">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  {startDate && endDate ? (
                    <>
                      <strong>{formatDate(startDate)}</strong> to <strong>{formatDate(endDate)}</strong> ({daysInclusive(startDate, endDate)} days)
                    </>
                  ) : startDate ? (
                    <>Start: {formatDate(startDate)}. Now click the end date.</>
                  ) : (
                    'No dates picked yet.'
                  )}
                </div>

                {availability && (
                  <div className="space-y-2">
                    <Label>Virtual machine ({VM_CATEGORY_LABELS[category]})</Label>
                    {suitable.length > 0 && (
                      <VmOption
                        selected={vmChoice === 'auto'}
                        onSelect={() => setVmChoice('auto')}
                        title="Assign automatically"
                        detail={`Smallest suitable VM: ${suitable[0].name}`}
                      />
                    )}
                    {availability.map((vm) => (
                      <VmOption
                        key={vm.id}
                        selected={vmChoice === vm.id}
                        disabled={!vm.available || !vm.meetsRequirements}
                        onSelect={() => setVmChoice(vm.id)}
                        title={vm.name}
                        detail={!vm.meetsRequirements ? `Too small (${specs(vm)})` : !vm.available ? 'Booked for these dates' : specs(vm)}
                      />
                    ))}
                    {willQueue && (
                      <p className="flex gap-2 rounded-lg bg-violet-500/10 p-3 text-sm">
                        <ListOrdered className="h-4 w-4 mt-0.5 shrink-0" />
                        No backup VM is free for these dates. You can still submit: you'll join the queue as number {queueLength + 1} and get an
                        email when a VM is assigned.
                      </p>
                    )}
                    {isTeaching && suitable.length === 0 && (
                      <p className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        No VM in this category meets the requirements for these dates. Try other dates, lower requirements, or another category.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && startDate && endDate && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>
              {willQueue
                ? 'This request will join the backup queue.'
                : 'The lab assistant will be emailed the schedule and requirements, then mark the system ready.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{BOOKING_TYPE_LABELS[type]}</dd>
              {course && (
                <>
                  <dt className="text-muted-foreground">Course</dt>
                  <dd>
                    {course.code} {course.name} ({course.lecturerName}), {DAYS_OF_WEEK[course.dayOfWeek]}s {course.startTime}–{course.endTime}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Purpose</dt>
              <dd>{purpose}</dd>
              <dt className="text-muted-foreground">Dates</dt>
              <dd>
                {formatDate(startDate)} – {formatDate(endDate)} ({daysInclusive(startDate, endDate)} days)
              </dd>
              <dt className="text-muted-foreground">Virtual machine</dt>
              <dd>{willQueue ? 'Assigned from the queue' : `${chosenVm?.name} (${VM_CATEGORY_LABELS[category]})`}</dd>
              <dt className="text-muted-foreground">Requirements</dt>
              <dd>{specs(req)}</dd>
              <dt className="text-muted-foreground">Software</dt>
              <dd>{req.software.join(', ') || 'None'}</dd>
              {notes && (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd>{notes}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!stepValid[step]} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button disabled={submitting} onClick={submit}>
            <Check className="mr-2 h-4 w-4" />
            {submitting ? 'Submitting…' : willQueue ? 'Join the queue' : 'Submit booking'}
          </Button>
        )}
      </div>
    </div>
  );
}

function VmOption({ selected, disabled, onSelect, title, detail }: { selected: boolean; disabled?: boolean; onSelect: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
      }`}
    >
      <span>
        <span className="font-medium">{title}</span>
        <span className="block text-muted-foreground">{detail}</span>
      </span>
      {selected && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}
