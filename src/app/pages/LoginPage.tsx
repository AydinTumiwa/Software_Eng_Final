import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FlaskConical, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '../components/ThemeToggle';
import { APP_NAME, ORGANIZATION, ROLE_LABELS } from '@shared/config';
import type { AppMeta } from '@shared/types';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<AppMeta | null>(null);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => undefined);
  }, []);

  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : '/app/dashboard'} replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.name}!`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(u.mustChangePassword ? '/change-password' : (from ?? '/app/dashboard'), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed right-4 top-4">
        <ThemeToggle variant="outline" />
      </div>
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Illustration */}
        <div className="hidden md:flex flex-col items-center justify-center p-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <FlaskConical className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-primary mb-2">{APP_NAME}</h1>
            <p className="text-xl text-muted-foreground">{ORGANIZATION} AI Lab virtual machine booking</p>
          </div>
          <img
            src="https://res.cloudinary.com/dcmdkdwlw/image/upload/q_auto/f_auto/v1777399374/login_building_dnkzmg.jpg"
            alt="University campus"
            className="rounded-2xl shadow-2xl max-w-md w-full"
          />
        </div>

        {/* Right side - Login Form */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                Use the university credentials the administrator gave you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="name@university.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button type="button" variant="link" className="px-0 h-auto" onClick={() => navigate('/forgot-password')}>
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  <Lock className="mr-2 h-4 w-4" />
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              {meta?.demoMode && meta.demoAccounts.length > 0 && (
                <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Demo mode: test accounts (password <code className="font-mono">{meta.demoPassword}</code>). Click to fill
                    in.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {meta.demoAccounts.map((a) => (
                      <Button
                        key={a.email}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs justify-start"
                        onClick={() => {
                          setEmail(a.email);
                          setPassword(meta.demoPassword ?? '');
                        }}
                      >
                        {ROLE_LABELS[a.role]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
