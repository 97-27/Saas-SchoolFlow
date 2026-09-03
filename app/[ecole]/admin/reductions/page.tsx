import React from 'react';
import { mockSpecialDiscounts, mockSchools } from '@/lib/data/mock-data';
import { SpecialDiscountsView } from '@/components/finance/special-discounts-view';

export default async function ReductionsPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <SpecialDiscountsView
      initialDiscounts={mockSpecialDiscounts}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
