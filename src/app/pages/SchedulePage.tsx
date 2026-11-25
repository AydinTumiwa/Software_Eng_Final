import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { CalendarClock, CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { DAYS_OF_WEEK, PROGRAMS, VM_CATEGORY_LABELS, type Program } from '@shared/config';
import { formatDate } from '@shared/dates';
import type { Course } from '@shared/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DateRangeField } from '../components/DateRangeField';
import { EmptyState, LoadState, PageHeader } from '../components/PageHeader';
import { useAuth, useUser } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

type CourseForm = Omit<Course, 'id' | 'lecturerName'>;
const EMPTY: CourseForm = {
  code: '',
  name: '',
  program: 'CS',
  lecturerId: 0,
  semester: '',
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '11:30',
  startDate: '',
  endDate: '',
};

// The academic schedule. Teaching reservations are based on these courses;
// the Academic Registry keeps it up to date.
export function SchedulePage() {
  const navigate = useNavigate();
  const user = useUser();
  const { can } = useAuth();
  const courses = useApi(() => api.courses.list());
  const lecturers = useApi(() => (can('manageSchedule') ? api.courses.lecturers() : Promise.resolve([])));
  const [semester, setSemester] = useState('all');
  const [editing, setEditing] = useState<{ id: number | null; form: CourseForm } | null>(null);
  const [saving, setSaving] = useState(false);

  const semesters = [...new Set((courses.data ?? []).map((c) => c.semester))];
  const list = (courses.data ?? []).filter((c) => semester === 'all' || c.semester === semester);
  const canBook = (c: Course) => can('bookTeaching') && (c.lecturerId === user.id || can('bookOnBehalf'));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) await api.courses.update(editing.id, editing.form);
      else await api.courses.create(editing.form);
      toast.success('Schedule saved');
      setEditing(null);
      courses.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Course) => {
    if (!window.confirm(`Delete ${c.code} ${c.name} from the schedule?`)) return;
    try {
      await api.courses.remove(c.id);
      toast.success('Course removed');
      courses.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const set = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic schedule"
        description="Courses and class times. Lecturers book lab VMs for their courses from here."
        actions={
          <>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All semesters</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can('manageSchedule') && (
              <Button onClick={() => setEditing({ id: null, form: { ...EMPTY, lecturerId: lecturers.data?.[0]?.id ?? 0 } })}>
                <Plus className="mr-2 h-4 w-4" /> Add course
              </Button>
            )}
          </>
        }
      />

      <LoadState loading={courses.loading && !courses.data} error={courses.error} />
      {courses.data && list.length === 0 && <EmptyState icon={<CalendarClock className="h-10 w-10" />} title="No courses on the schedule" />}
      {list.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Lecturer</TableHead>
                <TableHead>Class time</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-medium">
                      {c.code} {c.name}
                    </p>
                    <Badge variant="secondary">{VM_CATEGORY_LABELS[c.program]}</Badge>
                  </TableCell>
                  <TableCell>{c.lecturerName}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {DAYS_OF_WEEK[c.dayOfWeek]} {c.startTime}–{c.endTime}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.semester}
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(c.startDate)} – {formatDate(c.endDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canBook(c) && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/app/book?type=teaching&course=${c.id}`)}>
                          <CalendarPlus className="mr-1 h-4 w-4" /> Book VM
                        </Button>
                      )}
                      {can('manageSchedule') && (
                        <>
                          <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing({ id: c.id, form: { ...c } })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => remove(c)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit course' : 'Add course'}</DialogTitle>
            <DialogDescription>Teaching reservations use these class times and dates.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-code">Code</Label>
                <Input id="c-code" value={editing.form.code} onChange={(e) => set('code', e.target.value)} placeholder="CS301" />
              </div>
              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={editing.form.program} onValueChange={(v) => set('program', v as Program)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {VM_CATEGORY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" value={editing.form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Lecturer</Label>
                <Select value={editing.form.lecturerId ? String(editing.form.lecturerId) : ''} onValueChange={(v) => set('lecturerId', Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {(lecturers.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-sem">Semester</Label>
                <Input id="c-sem" value={editing.form.semester} onChange={(e) => set('semester', e.target.value)} placeholder="Odd 2026/2027" />
              </div>
              <div className="space-y-2">
                <Label>Day</Label>
                <Select value={String(editing.form.dayOfWeek)} onValueChange={(v) => set('dayOfWeek', Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAYS_OF_WEEK).map(([n, label]) => (
                      <SelectItem key={n} value={n}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="c-start">From</Label>
                  <Input id="c-start" type="time" value={editing.form.startTime} onChange={(e) => set('startTime', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-end">To</Label>
                  <Input id="c-end" type="time" value={editing.form.endTime} onChange={(e) => set('endTime', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="c-dates">First and last class</Label>
                <DateRangeField
                  id="c-dates"
                  start={editing.form.startDate}
                  end={editing.form.endDate}
                  onChange={(s, e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, startDate: s, endDate: e } } : ed))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
