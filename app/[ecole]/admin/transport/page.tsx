import React from 'react';
import { mockTransportSubscriptions, mockSchools } from '@/lib/data/mock-data';
import { TransportView } from '@/components/transport/transport-view';

export default async function TransportPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <TransportView
      initialSubscriptions={mockTransportSubscriptions}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
