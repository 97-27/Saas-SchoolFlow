import React from 'react';
import { PointageView } from '@/components/staff/pointage-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  return <PointageView schoolSlug={resolvedParams.ecole} />;
}
