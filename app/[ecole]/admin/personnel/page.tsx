import React from 'react';
import { schoolForSlug } from '@/lib/data/mock-data';
import { StaffView } from '@/components/staff/staff-view';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <StaffView
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
