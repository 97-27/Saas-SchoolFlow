import React from 'react';
import { mockSchools } from '@/lib/data/mock-data';
import { DiverseNotesView } from '@/components/notes/diverse-notes-view';

export default async function NotesDiversesPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <DiverseNotesView
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
