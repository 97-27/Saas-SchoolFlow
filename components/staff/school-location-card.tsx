'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Link2, ExternalLink, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import type { PointageConfig } from '@/lib/data/pointage';

/**
 * POSITION DE L'ÉCOLE POUR LE POINTAGE
 * L'école enregistre son emplacement exact : lien Google Maps (bouton « Partager » de Maps),
 * coordonnées, ou position actuelle du téléphone sur place. Une carte Google Maps affiche
 * l'emplacement retenu. Au pointage, le SERVEUR compare la position du téléphone à celle-ci et
 * refuse au-delà de la distance choisie. Utilisé dans Paramètres et dans la page Pointage.
 */
const RADIUS_CHOICES = [50, 100, 150, 200, 300, 500];

function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('La localisation n’est pas disponible sur cet appareil.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Localisation refusée : autorisez-la pour ce site dans le navigateur, puis réessayez.'
              : 'Position introuvable. Activez le GPS du téléphone et réessayez.'
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

async function saveConfig(config: Record<string, unknown>): Promise<PointageConfig> {
  const res = await fetch('/api/pointage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'config', config }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(j?.error || 'Enregistrement impossible. Réessayez.');
  return j.config;
}

export function SchoolLocationCard({
  config: initial,
  onSaved,
  embedded = false,
}: {
  /** Réglages déjà chargés (page Pointage) ; sinon la carte les lit elle-même (Paramètres). */
  config?: PointageConfig | null;
  onSaved?: (c: PointageConfig) => void;
  /** Dans une autre carte : pas de bordure ni de titre principal. */
  embedded?: boolean;
}) {
  const [config, setConfig] = useState<PointageConfig | null>(initial || null);
  const [canManage, setCanManage] = useState(!!initial);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (initial) {
      setConfig(initial);
      setCanManage(true);
      return;
    }
    fetch('/api/pointage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.success) {
          setConfig(j.config);
          setCanManage(!!j.canManage);
        }
      })
      .catch(() => {});
  }, [initial]);

  const run = async (key: string, fn: () => Promise<PointageConfig>, okText: string) => {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      const c = await fn();
      setConfig(c);
      onSaved?.(c);
      setMessage({ ok: true, text: okText });
      return true;
    } catch (e: any) {
      setMessage({ ok: false, text: e?.message || 'Erreur.' });
      return false;
    } finally {
      setBusy('');
    }
  };

  if (!config) {
    return <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">Chargement de la position de l’école…</div>;
  }

  const loc = config.location;
  const mapSrc = loc ? `https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=17&output=embed` : '';
  const mapsUrl = loc ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : '';

  return (
    <div className={embedded ? 'space-y-4' : 'bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4'}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-heading">Position de l’école pour le pointage</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Le personnel ne peut pointer que s’il se trouve à moins de <span className="font-bold text-slate-900">{config.radiusMeters} m</span> de
            cet emplacement. La position du téléphone est vérifiée par le serveur au moment du pointage.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
            message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {message.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Carte */}
      {loc ? (
        <div className="space-y-2">
          <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 h-56 sm:h-72">
            <iframe
              title="Emplacement de l’école"
              src={mapSrc}
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-mono font-bold text-slate-700">
              {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
            </span>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
            >
              Ouvrir dans Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
          Aucune position enregistrée : tant qu’elle ne l’est pas, la distance n’est pas vérifiée au pointage.
        </div>
      )}

      {canManage && (
        <>
          {/* 1. Lien Google Maps */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lien Google Maps de l’école (ou coordonnées)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  // Dans Paramètres, la carte est dans le formulaire de l'école : Entrée ne doit pas l'envoyer.
                  if (e.key === 'Enter') e.preventDefault();
                }}
                placeholder="https://maps.app.goo.gl/…  ou  5.3600, -4.0083"
                className="flex-1 min-w-0 px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
              />
              <button
                type="button"
                disabled={!!busy || !link.trim()}
                onClick={() =>
                  run('link', () => saveConfig({ mapLink: link.trim() }), 'Position de l’école enregistrée depuis Google Maps.').then(
                    (ok) => ok && setLink('')
                  )
                }
                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                {busy === 'link' ? 'Lecture du lien…' : 'Enregistrer'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dans Google Maps : appuyez longuement sur le bâtiment de l’école (une épingle rouge apparaît), puis « Partager » →
              « Copier le lien », et collez-le ici.
            </p>
          </div>

          {/* 2. Position actuelle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                run(
                  'here',
                  async () => {
                    const p = await getPosition();
                    if (p.accuracy > 100) {
                      throw new Error(
                        `Position imprécise (± ${Math.round(p.accuracy)} m). Activez le GPS, sortez dans la cour et réessayez, ou utilisez le lien Google Maps.`
                      );
                    }
                    return saveConfig({ location: { lat: p.lat, lng: p.lng } });
                  },
                  'Position actuelle enregistrée comme position de l’école.'
                )
              }
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              {busy === 'here' ? 'Localisation…' : 'Je suis à l’école : utiliser ma position'}
            </button>
            {loc && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run('clear', () => saveConfig({ location: null }), 'Contrôle de position retiré.')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Retirer la position
              </button>
            )}
          </div>

          {/* 3. Distance autorisée */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 block">Distance autorisée autour de l’école</span>
            <div className="flex flex-wrap gap-1.5">
              {RADIUS_CHOICES.map((r) => {
                const on = config.radiusMeters === r;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={!!busy}
                    onClick={() => run('radius', () => saveConfig({ radiusMeters: r }), `Distance autorisée : ${r} m.`)}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                      on ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                    }`}
                  >
                    {r} m
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Conseil : 100 à 200 m. En dessous de 50 m, un GPS de téléphone (précis à 10–50 m près) peut refuser une personne
              pourtant dans l’école.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
