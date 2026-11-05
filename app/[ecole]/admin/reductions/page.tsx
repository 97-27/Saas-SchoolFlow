import React from 'react';
import { mockSpecialDiscounts, schoolForSlug } from '@/lib/data/mock-data';
import { SpecialDiscountsView } from '@/components/finance/special-discounts-view';

export default async function ReductionsPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <SpecialDiscountsView
      initialDiscounts={mockSpecialDiscounts}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
