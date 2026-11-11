import React from 'react';
import { ArchivesView } from '@/components/archives/archives-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  return <ArchivesView schoolSlug={resolvedParams.ecole} />;
}
