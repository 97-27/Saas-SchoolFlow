import React from 'react';
import { schoolForSlug, mockStudents } from '@/lib/data/mock-data';
import { CommunicationView } from '@/components/communication/communication-view';

export default async function CommunicationPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <CommunicationView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
