import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Pencil, Search, UserPlus } from 'lucide-react';
import { PROGRAMS, ROLES, ROLE_LABELS, VM_CATEGORY_LABELS, type Program, type Role } from '@shared/config';
import type { User } from '@shared/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { LoadState, PageHeader } from '../components/PageHeader';
import { useUser } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

interface UserForm {
  name: string;
  email: string;
  role: Role;
  program: Program | null;
  studentId: string;
  isActive: boolean;
}
const EMPTY: UserForm = { name: '', email: '', role: 'student', program: 'CS', studentId: '', isActive: true };

// The administrator registers student and staff accounts. New accounts get a
// temporary password (emailed and shown once) that must be changed at first sign-in.
export function UsersPage() {
  const me = useUser();
  const users = useApi(() => api.users.list());
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: number | null; form: UserForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<{ name: string; email: string; password: string } | null>(null);

  const q = search.trim().toLowerCase();
  const list = (users.data ?? []).filter((u) => !q || [u.name, u.email, u.studentId, ROLE_LABELS[u.role]].some((v) => v?.toLowerCase().includes(q)));
  const set = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { form } = editing;
    const body = { ...form, studentId: form.studentId || null, program: form.program };
    try {
      if (editing.id) {
        await api.users.update(editing.id, body);
        toast.success('Account updated');
      } else {
        const res = await api.users.create(body);
        setIssued({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      }
      setEditing(null);
      users.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (u: User) => {
    if (!window.confirm(`Reset the password for ${u.name}? They will be emailed a temporary password.`)) return;
    try {
      const res = await api.users.resetPassword(u.id);
      setIssued({ name: u.name, email: u.email, password: res.temporaryPassword });
      users.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Register students, lecturers and staff. Everyone must change their temporary password at first sign-in."
        actions={
          <Button onClick={() => setEditing({ id: null, form: EMPTY })}>
            <UserPlus className="mr-2 h-4 w-4" /> Register user
          </Button>
        }
      />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, email, ID or role" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <LoadState loading={users.loading && !users.data} error={users.error} />
      {users.data && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Program / ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                  <TableCell>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell className="text-sm">
                    {u.program ?? '—'}
                    {u.studentId && <span className="block text-xs text-muted-foreground">{u.studentId}</span>}
                  </TableCell>
                  <TableCell>
                    {!u.isActive ? (
                      <Badge variant="outline">Deactivated</Badge>
                    ) : u.mustChangePassword ? (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300">Temporary password</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing({ id: u.id, form: { ...u, studentId: u.studentId ?? '' } })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Reset password" onClick={() => resetPassword(u)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit account' : 'Register user'}</DialogTitle>
            <DialogDescription>
              {editing?.id ? 'The email address cannot be changed.' : 'A temporary password is generated and emailed to the user.'}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="u-name">Full name</Label>
                <Input id="u-name" value={editing.form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="u-email">Email</Label>
                <Input id="u-email" type="email" value={editing.form.email} disabled={!!editing.id} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editing.form.role} onValueChange={(v) => set('role', v as Role)} disabled={editing.id === me.id}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={editing.form.program ?? 'none'} onValueChange={(v) => set('program', v === 'none' ? null : (v as Program))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PROGRAMS.map((p) => (
                      <SelectItem key={p} value={p}>{VM_CATEGORY_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing.form.role === 'student' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="u-sid">Student ID</Label>
                  <Input id="u-sid" value={editing.form.studentId} onChange={(e) => set('studentId', e.target.value)} />
                </div>
              )}
              {editing.id && editing.id !== me.id && (
                <label className="flex items-center gap-3 sm:col-span-2 text-sm">
                  <Switch checked={editing.form.isActive} onCheckedChange={(v) => set('isActive', v)} />
                  Account active
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Saving…' : editing?.id ? 'Save' : 'Register'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issued} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password for {issued?.name}</DialogTitle>
            <DialogDescription>
              It was emailed to {issued?.email}. It is shown only once; the user must change it when they sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-lg">{issued?.password}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => issued && navigator.clipboard.writeText(issued.password).then(() => toast.success('Copied'))}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
