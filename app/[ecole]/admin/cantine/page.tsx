import React from 'react';
import { mockCanteenSubscriptions, schoolForSlug } from '@/lib/data/mock-data';
import { CanteenView } from '@/components/canteen/canteen-view';

export default async function CantinePage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <CanteenView
      initialSubscriptions={mockCanteenSubscriptions}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
