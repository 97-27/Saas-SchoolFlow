import React from 'react';
import { mockStudents, mockInvoices, schoolForSlug } from '@/lib/data/mock-data';
import { ReportsView } from '@/components/reports/reports-view';
import { FiguresGate } from '@/components/ui/masked-figure';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <FiguresGate title="Rapport financier">
      <ReportsView
        initialStudents={mockStudents}
        initialInvoices={mockInvoices}
        school={school}
        schoolSlug={ecoleSlug}
      />
    </FiguresGate>
  );
}
