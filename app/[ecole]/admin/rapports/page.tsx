import React from 'react';
import { mockStudents, mockInvoices, mockSchools } from '@/lib/data/mock-data';
import { ReportsView } from '@/components/reports/reports-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <ReportsView
      initialStudents={mockStudents}
      initialInvoices={mockInvoices}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
