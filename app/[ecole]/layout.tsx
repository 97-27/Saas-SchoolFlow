import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockSchools } from '@/lib/data/mock-data';
import { loadSchoolPwaIdentity } from '@/lib/server/school-pwa';

interface SchoolLayoutProps {
  children: React.ReactNode;
  params: Promise<{ ecole: string }>;
}

/**
 * Chaque école installe SON application : le manifeste et le nom (sigle) viennent de l'école
 * (app/api/school-manifest). Sans cela, toutes les écoles installaient « School Flow Africa ».
 */
export async function generateMetadata({ params }: SchoolLayoutProps): Promise<Metadata> {
  const { ecole } = await params;
  const identity = await loadSchoolPwaIdentity(ecole);
  return {
    title: identity.label,
    manifest: `/api/school-manifest?ecole=${encodeURIComponent(identity.slug)}`,
    applicationName: identity.label,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: identity.label },
  };
}

export default async function SchoolLayout({
  children,
  params,
}: SchoolLayoutProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;

  return <>{children}</>;
}

