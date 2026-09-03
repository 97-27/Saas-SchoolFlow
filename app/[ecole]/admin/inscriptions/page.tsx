import React from 'react';
import { mockSchools, mockStudents } from '@/lib/data/mock-data';
import { InscriptionsView } from '@/components/students/inscriptions-view';

interface InscriptionsPageProps {
  params: Promise<{ ecole: string }> | { ecole: string };
}

export default async function InscriptionsPage({ params }: InscriptionsPageProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <InscriptionsView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
