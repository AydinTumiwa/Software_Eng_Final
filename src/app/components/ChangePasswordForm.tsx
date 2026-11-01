import React, { useState } from 'react';
import { toast } from 'sonner';
import { checkPassword, PASSWORD_RULES } from '@shared/config';
import type { User } from '@shared/types';
import { api } from '../api/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// Used on the forced first-login page and on the profile page.
export function ChangePasswordForm({ onChanged, submitLabel = 'Update password' }: { onChanged: (u: User) => void; submitLabel?: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const problems = next ? checkPassword(next) : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (problems.length) return setError(problems.join(' '));
    if (next !== confirm) return setError('The new passwords do not match.');
    setSaving(true);
    try {
      const user = await api.auth.changePassword(current, next);
      toast.success('Password changed');
      setCurrent('');
      setNext('');
      setConfirm('');
      onChanged(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        <p className={`text-xs ${problems.length ? 'text-destructive' : 'text-muted-foreground'}`}>
          At least {PASSWORD_RULES.minLength} characters
          {PASSWORD_RULES.requireLetter && ', with a letter'}
          {PASSWORD_RULES.requireNumber && ' and a number'}.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
