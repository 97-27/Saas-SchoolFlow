import React from 'react';
import { schoolForSlug, mockStudents } from '@/lib/data/mock-data';
import { DistinctionsView } from '@/components/grades/distinctions-view';

export default async function DistinctionsPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <DistinctionsView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
