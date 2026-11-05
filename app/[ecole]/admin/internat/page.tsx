import React from 'react';
import { mockBoardingStudents, schoolForSlug } from '@/lib/data/mock-data';
import { BoardingView } from '@/components/boarding/boarding-view';

export default async function InternatPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <BoardingView
      initialBoarders={mockBoardingStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
