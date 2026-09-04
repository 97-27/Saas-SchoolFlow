import React from 'react';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { mockKPIs, mockInvoices, mockStudents, mockSchools } from '@/lib/data/mock-data';

interface AdminPageProps {
  params: Promise<{ ecole: string }> | { ecole: string };
}

export default async function AdminRootPage({ params }: AdminPageProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <DashboardView
      school={school}
      schoolSlug={ecoleSlug}
      initialStudents={mockStudents}
      initialInvoices={mockInvoices}
      initialKPIs={mockKPIs}
    />
  );
}
