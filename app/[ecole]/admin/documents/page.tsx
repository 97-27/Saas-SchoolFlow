import React from 'react';
import { mockSchools, mockStudents } from '@/lib/data/mock-data';
import { DocumentsView } from '@/components/students/documents-view';

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
  searchParams?: Promise<{ search?: string }> | { search?: string };
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <DocumentsView
      initialStudents={mockStudents}
      school={school}
      schoolSlug={ecoleSlug}
      initialSearch={resolvedSearchParams.search || ''}
    />
  );
}
