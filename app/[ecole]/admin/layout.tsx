import React from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ ecole: string }> | { ecole: string };
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;

  return (
    <DashboardShell
      schoolSlug={ecoleSlug}
      breadcrumbs={['Administration', 'Tableau de bord']}
    >
      {children}
    </DashboardShell>
  );
}
