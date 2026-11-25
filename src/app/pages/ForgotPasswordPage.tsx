import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import { PASSWORD_RESET } from '@shared/config';
import type { AppMeta, ForgotPasswordResult } from '@shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PasswordHelpChat } from '../components/PasswordHelpChat';
import { api } from '../api/client';

// Self-service reset: the person enters their email and gets a one-time link
// (see PASSWORD_RESET in shared/config.ts). The AI assistant appears when the
// server has an Anthropic API key. Admins can still reset passwords on the Users page.
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ForgotPasswordResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.meta().then(setMeta).catch(() => undefined);
  }, []);

  const requestLink = async (address: string) => {
    setError('');
    try {
      const res = await api.auth.forgotPassword(address);
      setResult(res);
      toast.success('Reset link requested');
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    await requestLink(email).catch(() => undefined);
    setSending(false);
  };

  const selfService = meta?.selfServiceReset ?? true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Forgot your password?</CardTitle>
            <CardDescription>
              {selfService
                ? `Enter the university email your account uses. We'll email you a link to choose a new password; it works once and expires in ${PASSWORD_RESET.linkValidMinutes} minutes.`
                : 'Ask the administrator or the AI Lab assistant to reset your password. You will get an email with a temporary password.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selfService &&
              (result ? (
                <div className="space-y-3 rounded-lg bg-emerald-500/10 p-4 text-sm">
                  <p className="flex items-start gap-2">
                    <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {result.message}
                  </p>
                  {result.demoLink && (
                    <p className="rounded-md bg-background p-2 text-xs">
                      Demo mode (no mail server): the email is in the Email log.{' '}
                      <a className="text-primary underline" href={result.demoLink}>
                        Open the reset link
                      </a>
                    </p>
                  )}
                  <Button variant="link" className="h-auto p-0" onClick={() => setResult(null)}>
                    Use a different email
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      autoComplete="username"
                      placeholder="name@university.ac.id"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={sending} className="w-full">
                    {sending ? 'Sending…' : 'Email me a reset link'}
                  </Button>
                </form>
              ))}

            {selfService && meta?.aiHelp && <PasswordHelpChat onSendLink={requestLink} />}

            <p className="text-sm text-muted-foreground">
              No longer have access to that email? Ask the administrator or the AI Lab assistant to reset your password.
            </p>
            <Button variant="outline" onClick={() => navigate('/login')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
