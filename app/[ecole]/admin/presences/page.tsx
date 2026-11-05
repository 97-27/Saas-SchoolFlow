import React from 'react';
import { mockStudents, schoolForSlug } from '@/lib/data/mock-data';
import { AttendanceView } from '@/components/attendance/attendance-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <AttendanceView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
