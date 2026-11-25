import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { checkPassword, PASSWORD_RULES } from '@shared/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

// Opened from the link in the "Reset your password" email.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { setUser } = useAuth();
  const [valid, setValid] = useState<boolean | null>(null);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.auth
      .checkResetLink(token)
      .then((r) => setValid(r.valid))
      .catch(() => setValid(false));
  }, [token]);

  const problems = next ? checkPassword(next) : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (problems.length) return setError(problems.join(' '));
    if (next !== confirm) return setError('The new passwords do not match.');
    setSaving(true);
    try {
      const user = await api.auth.resetPassword(token, next);
      setUser(user);
      toast.success('Password changed. You are signed in.');
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Choose a new password</CardTitle>
          <CardDescription>
            {valid === false
              ? 'This reset link is invalid, has already been used, or has expired.'
              : 'Enter a new password for your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {valid === null && <p className="text-sm text-muted-foreground">Checking the link…</p>}
          {valid === false && (
            <Button onClick={() => navigate('/forgot-password')}>Request a new link</Button>
          )}
          {valid && (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
                <p className={`text-xs ${problems.length ? 'text-destructive' : 'text-muted-foreground'}`}>
                  At least {PASSWORD_RULES.minLength} characters, with a letter and a number.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Saving…' : 'Save password and sign in'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
