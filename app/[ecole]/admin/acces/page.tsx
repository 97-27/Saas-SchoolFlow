import React from 'react';
import { PageAccessView } from '@/components/admin/page-access-view';

export default async function Page({ params }: { params: Promise<{ ecole: string }> }) {
  const { ecole } = await params;
  return <PageAccessView schoolSlug={ecole} />;
}
