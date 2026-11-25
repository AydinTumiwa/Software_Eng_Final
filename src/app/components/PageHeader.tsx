import React from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold mb-1">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 px-4 text-center">
      <div className="mb-3 text-muted-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground max-w-md">{children}</div>}
    </div>
  );
}

export function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) return <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return null;
}
