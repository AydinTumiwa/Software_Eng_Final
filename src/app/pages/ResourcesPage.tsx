import { useState } from 'react';
import { toast } from 'sonner';
import { Cpu, HardDrive, MemoryStick, Monitor, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  OS_OPTIONS,
  SOFTWARE_CATALOG,
  VM_CATEGORIES,
  VM_CATEGORY_LABELS,
  VM_STATUSES,
  BOOKING_STATUS_LABELS,
  type VmCategory,
  type VmStatus,
} from '@shared/config';
import { formatDate } from '@shared/dates';
import type { Vm } from '@shared/types';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { VmStatusBadge } from '../components/StatusBadge';
import { LoadState, PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

type VmForm = Pick<Vm, 'name' | 'category' | 'cpuCores' | 'memoryGb' | 'storageGb' | 'os' | 'software' | 'status' | 'notes'>;
const EMPTY: VmForm = { name: '', category: 'CS', cpuCores: 4, memoryGb: 16, storageGb: 100, os: OS_OPTIONS[0], software: [], status: 'available', notes: '' };

// The AI Lab's virtual machines. Lab assistants add and edit them here.
export function ResourcesPage() {
  const { can } = useAuth();
  const vms = useApi(() => api.vms.list());
  const [category, setCategory] = useState<'all' | VmCategory>('all');
  const [editing, setEditing] = useState<{ id: number | null; form: VmForm } | null>(null);
  const [saving, setSaving] = useState(false);

  const list = (vms.data ?? []).filter((v) => category === 'all' || v.category === category);
  const set = <K extends keyof VmForm>(key: K, value: VmForm[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) await api.vms.update(editing.id, editing.form);
      else await api.vms.create(editing.form);
      toast.success('VM saved');
      setEditing(null);
      vms.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (vm: Vm) => {
    if (!window.confirm(`Delete ${vm.name}?`)) return;
    try {
      await api.vms.remove(vm.id);
      toast.success('VM deleted');
      vms.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lab resources"
        description="Virtual machines in the AI Lab, grouped by program."
        actions={
          can('manageVms') && (
            <Button onClick={() => setEditing({ id: null, form: EMPTY })}>
              <Plus className="mr-2 h-4 w-4" /> Add VM
            </Button>
          )
        }
      />

      <Tabs value={category} onValueChange={(v) => setCategory(v as typeof category)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {VM_CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {VM_CATEGORY_LABELS[c]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <LoadState loading={vms.loading && !vms.data} error={vms.error} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((vm) => (
          <Card key={vm.id} className={vm.status === 'retired' ? 'opacity-60' : ''}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{vm.name}</h3>
                  <p className="text-sm text-muted-foreground">{VM_CATEGORY_LABELS[vm.category]}</p>
                </div>
                <VmStatusBadge status={vm.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-muted-foreground" />{vm.cpuCores} cores</span>
                <span className="flex items-center gap-1.5"><MemoryStick className="h-4 w-4 text-muted-foreground" />{vm.memoryGb} GB</span>
                <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-muted-foreground" />{vm.storageGb} GB</span>
              </div>
              <p className="flex items-center gap-1.5 text-sm"><Monitor className="h-4 w-4 text-muted-foreground" />{vm.os}</p>
              <div className="flex flex-wrap gap-1">
                {vm.software.map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                {vm.currentBooking ? (
                  <>
                    <span className="font-medium">{BOOKING_STATUS_LABELS[vm.currentBooking.status]}</span> · {vm.currentBooking.userName} until{' '}
                    {formatDate(vm.currentBooking.endDate)}
                  </>
                ) : vm.nextBooking ? (
                  <>Free now · next booking from {formatDate(vm.nextBooking.startDate)}</>
                ) : (
                  'Free, no upcoming bookings'
                )}
              </div>
              {vm.notes && <p className="text-sm text-muted-foreground">{vm.notes}</p>}
              {can('manageVms') && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ id: vm.id, form: { ...vm, notes: vm.notes ?? '' } })}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(vm)}>
                    <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Delete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit VM' : 'Add VM'}</DialogTitle>
            <DialogDescription>Set the status to maintenance or retired to stop new bookings.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vm-name">Name</Label>
                <Input id="vm-name" value={editing.form.name} onChange={(e) => set('name', e.target.value)} placeholder="CS-VM-04" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editing.form.category} onValueChange={(v) => set('category', v as VmCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VM_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{VM_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <div className="space-y-2">
                  <Label htmlFor="vm-cpu">CPU cores</Label>
                  <Input id="vm-cpu" type="number" min={1} value={editing.form.cpuCores} onChange={(e) => set('cpuCores', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vm-mem">Memory (GB)</Label>
                  <Input id="vm-mem" type="number" min={1} value={editing.form.memoryGb} onChange={(e) => set('memoryGb', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vm-disk">Storage (GB)</Label>
                  <Input id="vm-disk" type="number" min={1} value={editing.form.storageGb} onChange={(e) => set('storageGb', Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Operating system</Label>
                <Select value={editing.form.os} onValueChange={(v) => set('os', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OS_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editing.form.status} onValueChange={(v) => set('status', v as VmStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Installed software</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SOFTWARE_CATALOG.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editing.form.software.includes(s)}
                        onCheckedChange={(c) => set('software', c ? [...editing.form.software, s] : editing.form.software.filter((x) => x !== s))}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vm-notes">Notes</Label>
                <Textarea id="vm-notes" rows={2} value={editing.form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
