import { Navigate, useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { useAuth } from '../auth/AuthContext';

// Shown after signing in with a temporary password set by the administrator.
// The server refuses every other request until the password is changed.
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, loading, setUser, logout } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Choose a new password</CardTitle>
          <CardDescription>
            Hi {user.name}. Your account was created with a temporary password. Please replace it before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChangePasswordForm
            submitLabel="Save and continue"
            onChanged={(u) => {
              setUser(u);
              navigate('/app/dashboard', { replace: true });
            }}
          />
          <Button variant="link" className="px-0" onClick={() => logout().then(() => navigate('/login'))}>
            Sign out instead
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
