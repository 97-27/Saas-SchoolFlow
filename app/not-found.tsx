'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Page introuvable (adresse mal tapée, ancien lien…) : message en français et retour direct
 * vers l'accueil de l'école au lieu de la page anglaise « 404 This page could not be found ».
 */
export default function NotFound() {
  const pathname = usePathname() || '';
  const m = pathname.match(/^\/([^/]+)\/admin(?:\/|$)/);
  const ecole = m ? m[1] : '';
  const home = ecole ? `/${ecole}/admin/dashboard` : '/';

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-5xl font-black text-emerald-600">404</p>
        <h1 className="mt-3 text-xl font-extrabold text-slate-900">Cette page n&apos;existe pas</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          L&apos;adresse est peut-être mal tapée{pathname ? ` (« ${pathname} »)` : ''}. Revenez à l&apos;accueil et utilisez
          le menu pour ouvrir la page souhaitée.
        </p>
        <Link
          href={home}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          {ecole ? 'Retour au tableau de bord' : "Retour à l'accueil"}
        </Link>
      </div>
    </main>
  );
}
