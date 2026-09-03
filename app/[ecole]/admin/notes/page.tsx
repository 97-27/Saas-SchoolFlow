import React from 'react';
import { mockStudents, mockSchools } from '@/lib/data/mock-data';
import { GradesView } from '@/components/grades/grades-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <GradesView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
