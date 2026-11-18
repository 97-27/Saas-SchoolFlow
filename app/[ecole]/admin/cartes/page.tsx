import React from 'react';
import { mockStudents, schoolForSlug } from '@/lib/data/mock-data';
import { StudentCardsView } from '@/components/cards/student-cards-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }>;
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return <StudentCardsView initialStudents={mockStudents} school={school} schoolSlug={ecoleSlug} />;
}
