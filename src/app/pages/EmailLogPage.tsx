import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { EmptyState, LoadState, PageHeader } from '../components/PageHeader';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { formatTimestamp } from '../utils/format';

const STATUS_STYLE = {
  sent: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
  logged: 'border-sky-500/30 text-sky-700 dark:text-sky-300',
  failed: 'border-red-500/30 text-red-700 dark:text-red-300',
};

// Every email the system has sent. Without SMTP settings emails are only
// recorded here ("logged"), which is useful for demos and testing.
export function EmailLogPage() {
  const emails = useApi(() => api.emails());
  const meta = useApi(() => api.meta());
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const q = search.trim().toLowerCase();
  const list = (emails.data ?? []).filter((e) => !q || e.to.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Email log"
        description={
          meta.data?.emailDelivery === 'smtp'
            ? 'Emails are delivered through the configured mail server.'
            : 'No mail server is configured, so emails are recorded here instead of being delivered. Set SMTP_HOST in .env to send them.'
        }
      />
      <Input className="max-w-md" placeholder="Search recipient or subject" value={search} onChange={(e) => setSearch(e.target.value)} />
      <LoadState loading={emails.loading && !emails.data} error={emails.error} />
      {emails.data?.length === 0 && <EmptyState icon={<Mail className="h-10 w-10" />} title="No emails yet" />}
      <div className="space-y-2">
        {list.map((e) => (
          <Card key={e.id} className="cursor-pointer" onClick={() => setOpen(open === e.id ? null : e.id)}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.subject}</p>
                  <p className="text-sm text-muted-foreground">To {e.to} · {formatTimestamp(e.createdAt)}</p>
                </div>
                <Badge variant="outline" className={`${STATUS_STYLE[e.status]} capitalize shrink-0`}>{e.status}</Badge>
              </div>
              {open === e.id && (
                <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm font-sans">{e.body}</pre>
              )}
              {e.error && <p className="mt-2 text-sm text-destructive">{e.error}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
