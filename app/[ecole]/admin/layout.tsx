import React from 'react';
import { redirect } from 'next/navigation';
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

  if (ecoleSlug === 'college-excellence') {
    redirect('/epc-manoi/admin');
  }

  return (
    <DashboardShell
      schoolSlug={ecoleSlug}
      breadcrumbs={['Administration', 'Tableau de bord']}
    >
      {children}
    </DashboardShell>
  );
}
