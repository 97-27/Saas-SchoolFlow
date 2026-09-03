import React from 'react';
import { AdministrationView } from '@/components/admin/administration-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;

  return <AdministrationView schoolSlug={ecoleSlug} />;
}
