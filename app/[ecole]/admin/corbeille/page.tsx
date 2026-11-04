import React from 'react';
import { JournalView } from '@/components/corbeille/journal-view';

export default async function CorbeillePage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  return <JournalView schoolSlug={resolvedParams.ecole} />;
}
