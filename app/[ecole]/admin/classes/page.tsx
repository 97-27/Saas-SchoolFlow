import React from 'react';
import { mockStudents, mockSchools } from '@/lib/data/mock-data';
import { ClassesView } from '@/components/classes/classes-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <ClassesView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
