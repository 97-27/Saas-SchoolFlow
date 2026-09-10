import React from 'react';
import { mockSchools, mockStudents } from '@/lib/data/mock-data';
import { ParentCommunicationView } from '@/components/parents/parent-communication-view';

export default async function ParentCommunicationPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['epc-manoi'];

  return (
    <ParentCommunicationView
      schoolSlug={ecoleSlug}
      initialSchool={school}
      initialStudents={mockStudents}
    />
  );
}
