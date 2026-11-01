import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Lock, User as UserIcon } from 'lucide-react';
import { PROGRAMS, ROLE_LABELS, VM_CATEGORY_LABELS } from '@shared/config';
import { PageHeader } from '../components/PageHeader';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { useAuth, useUser } from '../auth/AuthContext';
import { initials } from '../utils/format';

export function ProfilePage() {
  const user = useUser();
  const { setUser } = useAuth();

  const fields: [string, string][] = [
    ['Name', user.name],
    ['Email', user.email],
    ['Role', ROLE_LABELS[user.role]],
    ...(user.program && PROGRAMS.includes(user.program) ? [['Program', VM_CATEGORY_LABELS[user.program]] as [string, string]] : []),
    ...(user.studentId ? [['Student ID', user.studentId] as [string, string]] : []),
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Profile & password" description="Your account details are managed by the administrator." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <dl className="grid gap-2 text-sm">
            {fields.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change password
          </CardTitle>
          <CardDescription>Use a password you don't use anywhere else.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm onChanged={setUser} />
        </CardContent>
      </Card>
    </div>
  );
}
