import React from 'react';
import { mockSchools, mockStudents } from '@/lib/data/mock-data';
import { ParentBulletinsView } from '@/components/parents/parent-bulletins-view';

export default async function ParentBulletinsPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <ParentBulletinsView
      schoolSlug={ecoleSlug}
      initialSchool={school}
      initialStudents={mockStudents}
    />
  );
}
