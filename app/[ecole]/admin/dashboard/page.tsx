import React from 'react';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { mockKPIs, mockInvoices, mockStudents, schoolForSlug } from '@/lib/data/mock-data';

interface DashboardPageProps {
  params: Promise<{ ecole: string }> | { ecole: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Plus aucune lecture de la base ICI : la page attendait le téléchargement complet des élèves,
 * reçus et services (sans limite de temps) avant de s'afficher — c'est la page d'arrivée du
 * Fondateur et du Comptable, d'où une connexion qui pouvait durer très longtemps. Les données
 * sont lues par le navigateur (/api/sync, limité à 9 s) avant l'affichage (DataReadyGate).
 */
export default async function DashboardPage({ params }: DashboardPageProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;

  return (
    <DashboardView
      school={schoolForSlug(ecoleSlug)}
      schoolSlug={ecoleSlug}
      initialStudents={mockStudents}
      initialInvoices={mockInvoices}
      initialKPIs={mockKPIs}
    />
  );
}
