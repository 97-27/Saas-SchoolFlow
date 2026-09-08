import React from 'react';
import { mockInvoices, mockSchools } from '@/lib/data/mock-data';
import { CaisseView } from '@/components/finance/caisse-view';

export default async function ScolaritePage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['epc-manoi'];

  return (
    <CaisseView
      initialInvoices={mockInvoices}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
