import React from 'react';
import { notFound } from 'next/navigation';
import { mockSchools } from '@/lib/data/mock-data';

interface SchoolLayoutProps {
  children: React.ReactNode;
  params: Promise<{ ecole: string }> | { ecole: string };
}

export default async function SchoolLayout({
  children,
  params,
}: SchoolLayoutProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;

  // Verify school exists or default fallback
  const school = mockSchools[ecoleSlug] || (ecoleSlug === 'college-excellence' ? mockSchools['college-excellence'] : null);

  // If unknown tenant and not a valid test slug, return 404
  if (!school && ecoleSlug !== 'college-excellence' && ecoleSlug !== 'saint-joseph') {
    notFound();
  }

  return <>{children}</>;
}
