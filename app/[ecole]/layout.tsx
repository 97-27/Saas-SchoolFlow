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

  return <>{children}</>;
}

