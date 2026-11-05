import React from 'react';
import { schoolForSlug, mockStudents } from '@/lib/data/mock-data';
import { BulletinsView } from '@/components/grades/bulletins-view';

export default async function BulletinsPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <BulletinsView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
