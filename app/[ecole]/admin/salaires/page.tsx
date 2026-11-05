import React from 'react';
import { schoolForSlug } from '@/lib/data/mock-data';
import { SalariesView } from '@/components/salaries/salaries-view';

export default async function SalariesPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <SalariesView
      initialSchool={school}
      schoolSlug={ecoleSlug}
    />
  );
}
