'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, X, ClipboardList, CheckCircle2 } from 'lucide-react';
import { getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { defaultSchool } from '@/lib/data/mock-data';
import { FOUNDER_ROLES } from '@/lib/auth/roles';

const DISMISS_KEY = 'schoolflow_setup_reminder_dismissed_v1';

/**
 * Nouvelle école : tant que les informations essentielles (logo, coordonnées, année scolaire…)
 * ne sont pas renseignées dans Paramètres, un rappel s'affiche en haut pour le Fondateur, le
 * DGA et le Directeur. Fermable (il revient à la prochaine session) ; disparaît tout seul dès
 * que tout est complet.
 */
export function SetupReminder({ schoolSlug }: { schoolSlug: string }) {
  const [missing, setMissing] = useState<string[]>([]);
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const role = String(JSON.parse(localStorage.getItem('schoolflow_active_session_v2') || '{}').roleId || '');
      setEligible(FOUNDER_ROLES.includes(role) || role === 'directeur');
      // Pas de masquage mémorisé : tant que le paramétrage n'est pas complet, le rappel revient
      // à chaque connexion et à chaque chargement de page.
      setDismissed(false);
    } catch {
      setDismissed(false);
    }
    const compute = () => {
      const s = getLiveSchool(schoolSlug, defaultSchool);
      const m: string[] = [];
      if (!s.logoUrl) m.push('Logo de l’école');
      if (!s.stampUrl) m.push('Cachet officiel');
      if (!String(s.phone || '').trim()) m.push('Téléphone');
      if (!String(s.email || '').trim()) m.push('Email');
      // L'adresse physique se saisit dans Paramètres → Localisation (enregistrée dans « city »).
      if (!String(s.city || '').trim() && !String(s.address || '').trim()) m.push('Adresse');
      if (!String(s.founderName || '').trim()) m.push('Nom du Fondateur');
      if (!/^\d{4}-\d{4}$/.test(String(s.academicYear || ''))) m.push('Année scolaire');
      if (!s.hasMaternelle && !s.hasPrimaire && !s.hasCollege && !s.hasLycee) m.push('Cycles enseignés');
      setMissing(m);
    };
    compute();
    window.addEventListener(DATA_UPDATED_EVENT, compute);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, compute);
  }, [schoolSlug]);

  if (!eligible || dismissed || missing.length === 0) return null;

  // La croix ne masque le rappel que pour cette page : il revient au prochain chargement.
  const dismiss = () => setDismissed(true);

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 sm:p-4 flex items-start gap-3 print:hidden animate-in fade-in">
      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
        <ClipboardList className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-amber-950 font-heading">Terminez le paramétrage de votre école avant de travailler</p>
        <p className="text-xs text-amber-900 mt-0.5">
          Ces informations apparaissent sur les reçus, bulletins et documents officiels. Il manque :
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {missing.map((m) => (
            <span key={m} className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-900">
              {m}
            </span>
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Link
            href={`/${schoolSlug}/admin/parametres`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <Settings className="w-3.5 h-3.5" /> Ouvrir les Paramètres
          </Link>
          <span className="text-[11px] text-amber-800 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ce rappel disparaît tout seul une fois tout renseigné.
          </span>
        </div>
      </div>
      <button type="button" onClick={dismiss} className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 cursor-pointer shrink-0" title="Fermer pour cette session">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
