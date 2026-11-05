import React from 'react';
import { schoolForSlug } from '@/lib/data/mock-data';
import { VersementsView } from '@/components/finance/versements-view';

export default async function VersementsPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return <VersementsView school={school} schoolSlug={ecoleSlug} />;
}
