import React from 'react';
import { mockSchools, mockStudents } from '@/lib/data/mock-data';
import { HealthView } from '@/components/health/health-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['epc-manoi'];

  return (
    <HealthView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
