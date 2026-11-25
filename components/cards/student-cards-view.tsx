'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Printer, ScanLine, Search, Camera, CameraOff, MessageCircle, CheckCircle2, AlertTriangle, Users, X } from 'lucide-react';
import type { School, Student } from '@/lib/data/types';
import {
  DATA_UPDATED_EVENT,
  flushPendingPhotos,
  getLiveSchool,
  getLiveStudents,
  getUnsentPhotoIds,
  saveStudentPhoto,
  updateRegisteredStudent,
} from '@/lib/data/live-store';
import { STUDENT_WRITE_ROLES } from '@/lib/auth/roles';
import {
  CARD_CSS,
  CARDS_PER_PAGE,
  frDate,
  hasRealBirthDate,
  parentPhone,
  parseQrPayload,
  printDocumentHtml,
  qrPayload,
  schoolContact,
  sheetsHtml,
  whatsappNumber,
} from '@/components/cards/card-design';

type ScanRecord = { at: string; by?: string; notifiedAt?: string };
type ScanMap = Record<string, ScanRecord>;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

async function makeQr(text: string): Promise<string> {
  const mod: any = await import('qrcode');
  const toDataURL = mod.toDataURL || mod.default?.toDataURL;
  return toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#0f172a', light: '#ffffff' } });
}

export function StudentCardsView({ initialStudents, school, schoolSlug }: { initialStudents: Student[]; school: School; schoolSlug: string }) {
  const slug = (schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug) || 'epc-manoi';
  const [tab, setTab] = useState<'cartes' | 'photos' | 'scan'>('cartes');
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    const load = () => {
      setStudents(getLiveStudents(initialStudents, slug));
      setCurrentSchool(getLiveSchool(slug, school));
    };
    load();
    try {
      setRoleId(JSON.parse(localStorage.getItem('schoolflow_active_session_v2') || '{}').roleId || '');
    } catch {}
    window.addEventListener(DATA_UPDATED_EVENT, load);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, load);
  }, [initialStudents, slug, school]);

  const sorted = useMemo(
    () => [...students].sort((a, b) => (a.grade || '').localeCompare(b.grade || '', 'fr') || (a.lastName || a.fullName).localeCompare(b.lastName || b.fullName, 'fr')),
    [students]
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Cartes scolaires & Scan</h1>
            <p className="text-xs text-slate-500">
              {sorted.length} élèves • une carte (recto + verso avec QR) est prête pour chaque élève inscrit
            </p>
          </div>
        </div>
        <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs self-start">
          {(
            [
              ['cartes', 'Cartes', CreditCard],
              ['photos', 'Photos', Camera],
              ['scan', 'Scanner les arrivées', ScanLine],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                tab === id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'cartes' ? (
        <CardsTab students={sorted} school={currentSchool} slug={slug} canEdit={STUDENT_WRITE_ROLES.includes(roleId)} />
      ) : tab === 'photos' ? (
        <PhotosTab students={sorted} slug={slug} canEdit={STUDENT_WRITE_ROLES.includes(roleId)} />
      ) : (
        <ScanTab students={sorted} school={currentSchool} slug={slug} />
      )}
    </div>
  );
}

/* ═════════════════════════ ONGLET CARTES ═════════════════════════ */

function CardsTab({ students, school, slug, canEdit }: { students: Student[]; school: School; slug: string; canEdit: boolean }) {
  const [grade, setGrade] = useState('Toutes les classes');
  const [query, setQuery] = useState('');
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [showFix, setShowFix] = useState(false);
  const [printing, setPrinting] = useState(false);

  const grades = useMemo(() => ['Toutes les classes', ...Array.from(new Set(students.map((s) => s.grade).filter(Boolean)))], [students]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter(
      (s) =>
        (grade === 'Toutes les classes' || s.grade === grade) &&
        (!q || s.fullName.toLowerCase().includes(q) || (s.studentNumber || '').toLowerCase().includes(q) || (s.matricule || '').toLowerCase().includes(q))
    );
  }, [students, grade, query]);

  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(list.length / CARDS_PER_PAGE));
  const curPage = Math.min(page, pageCount - 1);
  const preview = list.slice(curPage * CARDS_PER_PAGE, (curPage + 1) * CARDS_PER_PAGE);
  useEffect(() => setPage(0), [grade, query]);
  const missingPlace = list.filter((s) => !s.placeOfBirth).length;
  const missingBirth = list.filter((s) => !hasRealBirthDate(s)).length;

  const ensureQrs = useCallback(
    async (items: Student[]) => {
      const next: Record<string, string> = {};
      for (const s of items) {
        if (qrs[s.id]) continue;
        try {
          next[s.id] = await makeQr(qrPayload(slug, s.id));
        } catch {}
      }
      if (Object.keys(next).length) setQrs((prev) => ({ ...prev, ...next }));
      return { ...qrs, ...next };
    },
    [qrs, slug]
  );

  useEffect(() => {
    void ensureQrs(preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, query, students.length, curPage]);

  const handlePrint = async () => {
    if (list.length === 0) return;
    // La fenêtre s'ouvre tout de suite (clic de l'utilisateur) ; les QR sont préparés ensuite.
    const w = window.open('', '_blank');
    if (!w) {
      alert('Le navigateur a bloqué la fenêtre d’impression : autorisez les fenêtres pop-up pour ce site, puis réessayez.');
      return;
    }
    setPrinting(true);
    w.document.write('<p style="font-family:Arial;padding:20px">Préparation des cartes…</p>');
    try {
      const all = await ensureQrs(list);
      const html = printDocumentHtml(sheetsHtml(list, school, all), `Cartes scolaires — ${school.shortName || school.name}`);
      w.document.open();
      w.document.write(html.replace('<head>', `<head><base href="${location.origin}/">`));
      w.document.close();
      // Laisse les logos / photos se charger avant d'ouvrir l'impression.
      const imgs = Array.from(w.document.images);
      await Promise.race([
        Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = () => r(null); })))),
        new Promise((r) => setTimeout(r, 6000)),
      ]);
      w.focus();
      w.print();
    } catch {
      w.close();
      alert('Impossible de préparer les cartes. Réessayez.');
    } finally {
      setPrinting(false);
    }
  };

  const saveIdentity = (s: Student, patch: Partial<Student>) => {
    const updated: Student = { ...s, ...patch, updatedAt: new Date().toISOString() };
    updateRegisteredStudent(updated, slug);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, numéro ou matricule…"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              {grades.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing || list.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            {printing ? 'Préparation…' : `Imprimer ${list.length} carte${list.length > 1 ? 's' : ''} (A4, ${CARDS_PER_PAGE} par page)`}
          </button>
        </div>

        {(missingPlace > 0 || missingBirth > 0) && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                {missingPlace} élève(s) sans lieu de naissance, {missingBirth} sans date de naissance réelle : ces informations restent en pointillés sur la carte.
              </span>
            </span>
            <button type="button" onClick={() => setShowFix((v) => !v)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold cursor-pointer whitespace-nowrap">
              {showFix ? 'Masquer' : 'Compléter les fiches'}
            </button>
          </div>
        )}

        {showFix && (
          <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-2xl">
            {!canEdit && <p className="p-3 text-xs text-slate-500">Seuls le Fondateur, le DGA, le Directeur et le Comptable peuvent modifier les fiches.</p>}
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 px-3">Élève</th>
                  <th className="py-2 px-3">Classe</th>
                  <th className="py-2 px-3">Date de naissance</th>
                  <th className="py-2 px-3">Lieu de naissance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-3 font-bold text-slate-900">{s.fullName}</td>
                    <td className="py-2 px-3 text-slate-600">{s.grade}</td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        disabled={!canEdit}
                        defaultValue={hasRealBirthDate(s) ? s.dateOfBirth : ''}
                        onBlur={(e) => e.target.value && e.target.value !== s.dateOfBirth && saveIdentity(s, { dateOfBirth: e.target.value })}
                        className="px-2 py-1 rounded-lg border border-slate-300 text-xs disabled:bg-slate-50"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        defaultValue={s.placeOfBirth || ''}
                        placeholder="Ville / village"
                        maxLength={60}
                        onBlur={(e) => e.target.value.trim() !== (s.placeOfBirth || '') && saveIdentity(s, { placeOfBirth: e.target.value.trim() })}
                        className="w-full min-w-[150px] px-2 py-1 rounded-lg border border-slate-300 text-xs disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-900 font-heading">
            Aperçu — page {curPage + 1} / {pageCount} ({list.length} carte{list.length > 1 ? 's' : ''} au total)
          </h2>
          {pageCount > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={curPage === 0}
                onClick={() => setPage(curPage - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                ← Précédent
              </button>
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border ${
                    i === curPage ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={curPage >= pageCount - 1}
                onClick={() => setPage(curPage + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
        {preview.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Aucun élève ne correspond.</p>
        ) : (
          <div className="overflow-x-auto bg-slate-100 rounded-2xl p-3">
            <style>{CARD_CSS}</style>
            <div style={{ minWidth: '178mm' }} dangerouslySetInnerHTML={{ __html: sheetsHtml(preview, school, qrs) }} />
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Au moment d’imprimer, choisissez « Enregistrer en PDF » ou votre imprimante, format A4, marges « Aucune » ou « Par défaut », échelle 100 %.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════ ONGLET PHOTOS ═════════════════════════ */

/**
 * Réduit la photo (fichier de l'appareil ou photo déjà enregistrée) à 320 px max et ≈ 20 Ko : légère
 * pour le stockage, la synchronisation et la carte. L'orientation de l'appareil photo est respectée quand le
 * navigateur le permet (photos de téléphone), et un fond blanc remplace la transparence des PNG.
 */
async function resizePhoto(source: Blob): Promise<Blob> {
  let width = 0;
  let height = 0;
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void = () => {};
  let release = () => {};
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(source, { imageOrientation: 'from-image' } as any);
      width = bmp.width;
      height = bmp.height;
      draw = (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h);
      release = () => bmp.close?.();
    } catch {
      width = 0;
    }
  }
  if (!width) {
    const url = URL.createObjectURL(source);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image illisible'));
      el.src = url;
    }).finally(() => URL.revokeObjectURL(url));
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
    draw = (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h);
  }
  if (!width || !height) throw new Error('Image illisible');
  if (!width || !height) throw new Error('Image illisible');
  // Compression progressive : on essaie des dimensions et des qualités de plus en plus basses
  // jusqu'à passer sous PHOTO_TARGET_BYTES (≈ 20 Ko, soit 10 à 20 fois moins qu'une photo brute).
  // WebP quand le navigateur le sait (20 à 30 % plus léger), sinon JPEG.
  let best: Blob | null = null;
  try {
    for (const side of PHOTO_SIDES) {
      const ratio = Math.min(1, side / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image illisible');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      draw(ctx, canvas.width, canvas.height);
      for (const quality of PHOTO_QUALITIES) {
        let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob || blob.type !== 'image/webp') blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= PHOTO_TARGET_BYTES) return blob;
      }
    }
  } finally {
    release();
  }
  if (!best) throw new Error('Image illisible');
  return best;
}

/** Cible de poids d'une photo d'élève et paliers de réduction (voir resizePhoto). */
const PHOTO_TARGET_BYTES = 20 * 1024;
const PHOTO_SIDES = [320, 280, 240, 200];
const PHOTO_QUALITIES = [0.78, 0.64, 0.5];


function PhotosTab({ students, slug, canEdit }: { students: Student[]; slug: string; canEdit: boolean }) {
  const [grade, setGrade] = useState('Toutes les classes');
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [unsentIds, setUnsentIds] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState('');
  const grades = useMemo(() => ['Toutes les classes', ...Array.from(new Set(students.map((s) => s.grade).filter(Boolean)))], [students]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter(
      (s) =>
        (grade === 'Toutes les classes' || s.grade === grade) &&
        (!onlyMissing || !s.avatar) &&
        (!q || s.fullName.toLowerCase().includes(q) || (s.studentNumber || '').toLowerCase().includes(q) || (s.matricule || '').toLowerCase().includes(q))
    );
  }, [students, grade, query, onlyMissing]);
  const withPhoto = students.filter((s) => s.avatar).length;

  // Photos encore en attente d'envoi sur cet appareil (réseau coupé, refus du serveur…).
  useEffect(() => {
    const refresh = () => setUnsentIds(getUnsentPhotoIds(slug));
    refresh();
    window.addEventListener(DATA_UPDATED_EVENT, refresh);
    const timer = window.setInterval(() => {
      if (getUnsentPhotoIds(slug).length > 0) void flushPendingPhotos(slug).then(refresh);
    }, 15000);
    return () => {
      window.removeEventListener(DATA_UPDATED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [slug]);

  const setBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  const setFailed = (id: string, on: boolean) =>
    setFailedIds((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));

  /** Prépare, téléverse puis enregistre la photo ; false si une étape échoue (rien n'est perdu). */
  const storePhoto = async (s: Student, source: Blob): Promise<boolean> => {
    const small = await resizePhoto(source);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Lecture impossible'));
      reader.readAsDataURL(small);
    });
    // La photo s'affiche IMMÉDIATEMENT (avant l'envoi) ; le téléversement, l'enregistrement et les
    // nouveaux essais se font ensuite en arrière-plan (voir saveStudentPhoto).
    return saveStudentPhoto(s, dataUrl, slug);
  };

  const pick = async (s: Student, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('Choisissez un fichier image (JPG, PNG ou WEBP).');
      return;
    }
    setBusy(s.id, true);
    setFailed(s.id, false);
    setMsg(`Photo de ${s.fullName} affichée — envoi au serveur en cours…`);
    try {
      const ok = await storePhoto(s, file);
      setMsg(
        ok
          ? `Photo de ${s.fullName} enregistrée sur le serveur : elle apparaît sur tous les appareils.`
          : `La photo de ${s.fullName} est gardée sur cet appareil et sera renvoyée automatiquement dès que la connexion le permet.`
      );
    } catch {
      setFailed(s.id, true);
      setMsg('Impossible de lire cette photo. Essayez un autre fichier.');
    } finally {
      setBusy(s.id, false);
      setUnsentIds(getUnsentPhotoIds(slug));
    }
  };

  const retryUnsent = async () => {
    setMsg('Nouvel envoi des photos en attente…');
    const ok = await flushPendingPhotos(slug);
    setUnsentIds(getUnsentPhotoIds(slug));
    setMsg(ok ? 'Toutes les photos sont enregistrées sur le serveur.' : 'Certaines photos n’ont toujours pas pu être envoyées. Vérifiez la connexion.');
  };

  // Anciennes photos stockées en texte lourd dans la fiche : converties en images légères sur le serveur.
  const heavyPhotos = useMemo(() => students.filter((s) => s.avatar && s.avatar.startsWith('data:') && /^[0-9a-f-]{36}$/i.test(s.id)), [students]);
  const optimizeAll = async () => {
    const todo = heavyPhotos;
    setOptimizing({ done: 0, total: todo.length });
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      try {
        const blob = await (await fetch(todo[i].avatar!)).blob();
        if (!(await storePhoto(todo[i], blob))) failed++;
      } catch {
        failed++;
      }
      setOptimizing({ done: i + 1, total: todo.length });
    }
    setOptimizing(null);
    setUnsentIds(getUnsentPhotoIds(slug));
    setMsg(failed === 0 ? `${todo.length} photo(s) optimisées.` : `${todo.length - failed} photo(s) optimisées, ${failed} à reprendre (bouton « Optimiser » de nouveau).`);
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, numéro ou matricule…" className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className="px-3 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer">
            {grades.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            Sans photo seulement
          </label>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold self-start">
          {withPhoto} / {students.length} photos
        </span>
      </div>
      {!canEdit && <p className="text-xs text-slate-500">Seuls le Fondateur, le DGA, le Directeur et le Comptable peuvent ajouter des photos.</p>}
      {msg && <p className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">{msg}</p>}
      {canEdit && unsentIds.length > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 flex flex-wrap items-center gap-2">
          <span>{unsentIds.length} photo(s) sont gardées sur cet appareil mais pas encore enregistrées sur le serveur.</span>
          <button type="button" onClick={() => void retryUnsent()} className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold cursor-pointer hover:bg-amber-700">
            Renvoyer maintenant
          </button>
        </div>
      )}
      {canEdit && heavyPhotos.length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-wrap items-center gap-2">
          <span>
            {heavyPhotos.length} ancienne(s) photo(s) sont en format lourd (lent à charger, parfois absentes sur les autres appareils).
          </span>
          <button
            type="button"
            disabled={!!optimizing}
            onClick={() => void optimizeAll()}
            className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold cursor-pointer hover:bg-slate-900 disabled:opacity-50"
          >
            {optimizing ? `Optimisation ${optimizing.done} / ${optimizing.total}…` : 'Optimiser'}
          </button>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">Aucun élève ne correspond.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {list.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 flex flex-col items-center gap-2 text-center">
              <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center text-slate-300 text-2xl font-extrabold">
                {s.avatar ? (
                  <img
                    src={s.avatar}
                    alt={s.fullName}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Photo illisible : on cache l'image cassée, les initiales restent visibles derrière.
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  (s.firstName || '?')[0]
                )}
              </div>
              <p className="text-[11px] font-bold text-slate-900 leading-tight break-words">{s.fullName}</p>
              <p className="text-[10px] text-slate-500">{s.grade}</p>
              {s.avatar && unsentIds.includes(s.id) && <p className="text-[10px] font-bold text-amber-700">Pas encore sur le serveur</p>}
              {failedIds.includes(s.id) && !s.avatar && <p className="text-[10px] font-bold text-red-600">Envoi échoué</p>}
              {canEdit && (
                <label className={`w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer ${failedIds.includes(s.id) ? 'bg-red-600 hover:bg-red-700' : s.avatar ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'} ${busyIds.includes(s.id) ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Camera className="w-3.5 h-3.5" />
                  {busyIds.includes(s.id) ? 'Envoi…' : failedIds.includes(s.id) ? 'Réessayer' : s.avatar ? 'Changer la photo' : 'Ajouter la photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(s, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════ ONGLET SCAN ═════════════════════════ */

function ScanTab({ students, school, slug }: { students: Student[]; school: School; slug: string }) {
  const scansKey = `schoolflow_arrival_scans_v1_${slug}`;
  const [scans, setScans] = useState<ScanMap>({});
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ student: Student; at: string; already: boolean } | null>(null);
  const [manual, setManual] = useState('');
  const [pending, setPending] = useState<Student | null>(null);
  const [pendingPresent, setPendingPresent] = useState(false); // par défaut : ABSENT, à cocher présent à la main
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ text: string; t: number }>({ text: '', t: 0 });
  const studentsRef = useRef(students);
  studentsRef.current = students;

  const readScans = useCallback((): ScanMap => {
    try {
      return JSON.parse(localStorage.getItem(scansKey) || '{}') || {};
    } catch {
      return {};
    }
  }, [scansKey]);

  useEffect(() => {
    setScans(readScans());
    const reload = () => setScans(readScans());
    window.addEventListener(DATA_UPDATED_EVENT, reload);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, reload);
  }, [readScans]);

  const day = todayIso();
  const mine = (id: string) => scans[`${day}_${id}`];
  const arrivedCount = students.filter((s) => mine(s.id)).length;
  const absentees = students.filter((s) => !mine(s.id));

  const sessionName = () => {
    try {
      const s = JSON.parse(localStorage.getItem('schoolflow_active_session_v2') || '{}');
      return s.fullName || s.name || s.roleId || '';
    } catch {
      return '';
    }
  };

  const register = useCallback(
    (student: Student) => {
      const fresh = readScans();
      const key = `${todayIso()}_${student.id}`;
      const existing = fresh[key];
      if (existing) {
        setResult({ student, at: existing.at, already: true });
        return;
      }
      const rec: ScanRecord = { at: new Date().toISOString(), by: sessionName() };
      const next = { ...fresh, [key]: rec };
      try {
        localStorage.setItem(scansKey, JSON.stringify(next));
      } catch {}
      setScans(next);
      setResult({ student, at: rec.at, already: false });
    },
    [readScans, scansKey]
  );

  const handleText = useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastRef.current.text === text && now - lastRef.current.t < 4000) return;
      lastRef.current = { text, t: now };
      const parsed = parseQrPayload(text);
      if (!parsed) {
        setError('Ce QR code n’est pas une carte scolaire SchoolFlow.');
        return;
      }
      const student = studentsRef.current.find((s) => s.id === parsed.studentId);
      if (!student) {
        setError('Élève introuvable : la carte est peut-être d’une autre école ou d’un élève supprimé.');
        return;
      }
      setError('');
      // On affiche d'abord la fiche de l'élève : rien n'est enregistré tant qu'on n'a pas validé.
      setPending(student);
      setPendingPresent(false);
      setResult(null);
    },
    []
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La caméra n’est pas disponible sur cet appareil / ce navigateur (ouvrez le site en HTTPS dans Chrome).');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setActive(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      const Detector = (window as any).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
      let jsQR: any = null;
      if (!detector) jsQR = (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
      const loop = async () => {
        if (!streamRef.current) return;
        try {
          if (video.readyState >= 2) {
            if (detector) {
              const found = await detector.detect(video);
              if (found?.[0]?.rawValue) handleText(found[0].rawValue);
            } else if (ctx && video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (code?.data) handleText(code.data);
            }
          }
        } catch {}
        setTimeout(loop, 200);
      };
      loop();
    } catch (e: any) {
      stop();
      setError(
        e?.name === 'NotAllowedError'
          ? 'Caméra refusée. Touchez le cadenas à gauche de l’adresse → Autorisations → Caméra → Autoriser, puis réessayez.'
          : e?.message || 'Impossible d’ouvrir la caméra.'
      );
    }
  };

  const manualMatches = useMemo(() => {
    const q = manual.trim().toLowerCase();
    if (q.length < 2) return [];
    return students.filter((s) => s.fullName.toLowerCase().includes(q) || (s.studentNumber || '').toLowerCase() === q || (s.matricule || '').toLowerCase() === q).slice(0, 6);
  }, [manual, students]);

  const waArrival = (s: Student, at: string) => {
    const phone = whatsappNumber(parentPhone(s));
    const text =
      `Bonjour ${s.guardianName ? `Cher parent (${s.guardianName})` : 'Cher parent'},\n\n` +
      `Votre enfant *${s.fullName}* (${s.grade}) est bien arrivé(e) à l'école ce ${frDate(todayIso())} à *${hhmm(at)}*.\n\n` +
      `Merci pour votre compréhension.\n_${school.name}_${schoolContact(school) ? ` — ${schoolContact(school)}` : ''}`;
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : '';
  };
  const waAbsent = (s: Student) => {
    const phone = whatsappNumber(parentPhone(s));
    const text =
      `Bonjour ${s.guardianName ? `Cher parent (${s.guardianName})` : 'Cher parent'},\n\n` +
      `Nous vous informons que votre enfant *${s.fullName}* (${s.grade}) n'est pas arrivé(e) à l'école ce ${frDate(todayIso())}.\n\n` +
      `Merci de nous en indiquer la raison${schoolContact(school) ? ` au ${schoolContact(school)}` : ''}.\n_${school.name}_`;
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : '';
  };

  const markNotified = (s: Student) => {
    const fresh = readScans();
    const key = `${todayIso()}_${s.id}`;
    if (!fresh[key]) return;
    const next = { ...fresh, [key]: { ...fresh[key], notifiedAt: new Date().toISOString() } };
    try {
      localStorage.setItem(scansKey, JSON.stringify(next));
    } catch {}
    setScans(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-900 font-heading flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-emerald-600" /> Arrivées du {frDate(day)}
          </h2>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
            {arrivedCount} / {students.length} arrivés
          </span>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center">
          <video ref={videoRef} muted playsInline className={`w-full h-full object-cover ${active ? '' : 'hidden'}`} />
          {!active && <p className="text-xs text-slate-300 px-6 text-center">Appuyez sur « Démarrer la caméra » puis présentez le QR de la carte de l’élève.</p>}
          {active && <div className="absolute inset-[18%] border-2 border-amber-400 rounded-2xl pointer-events-none" />}
        </div>

        <div className="flex gap-2">
          {!active ? (
            <button type="button" onClick={start} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
              <Camera className="w-4 h-4" /> Démarrer la caméra
            </button>
          ) : (
            <button type="button" onClick={stop} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer">
              <CameraOff className="w-4 h-4" /> Arrêter la caméra
            </button>
          )}
        </div>

        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">{error}</p>}

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sans caméra : chercher l’élève</p>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Nom, numéro (ID-014) ou matricule…"
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {manualMatches.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setPending(s);
                setPendingPresent(false);
                setResult(null);
                setManual('');
              }}
              className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:bg-emerald-50 text-xs cursor-pointer"
            >
              <span className="font-bold text-slate-900">{s.fullName}</span> <span className="text-slate-500">• {s.grade}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {pending && (
          <div className="p-4 sm:p-5 rounded-3xl border-2 border-slate-300 bg-white shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-extrabold shrink-0">
                  {pending.avatar ? <img src={pending.avatar} alt="" className="w-full h-full object-cover" /> : (pending.firstName || '?')[0]}
                </div>
                <div className="min-w-0 text-xs space-y-0.5">
                  <p className="text-sm font-extrabold text-slate-900 break-words">{pending.fullName}</p>
                  <p className="text-slate-700">Classe : <b>{pending.grade}</b></p>
                  <p className="text-slate-700">N° : <b>{pending.studentNumber || '—'}</b> • Matricule : <b>{pending.matricule || '—'}</b></p>
                  <p className="text-slate-700">Parent : <b>{pending.guardianName || '—'}</b> • {parentPhone(pending) || 'aucun numéro'}</p>
                  {mine(pending.id) && <p className="font-bold text-amber-800">Déjà pointé à {hhmm(mine(pending.id)!.at)} aujourd’hui.</p>}
                </div>
              </div>
              <button type="button" onClick={() => setPending(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPendingPresent(false)} className={`py-2.5 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${!pendingPresent ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                Absent
              </button>
              <button type="button" onClick={() => setPendingPresent(true)} className={`py-2.5 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${pendingPresent ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                Présent
              </button>
            </div>
            {pendingPresent ? (
              <button
                type="button"
                onClick={() => {
                  register(pending);
                  setPending(null);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              >
                Valider la présence puis prévenir le parent
              </button>
            ) : waAbsent(pending) ? (
              <a href={waAbsent(pending)} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700">
                Envoyer l’absence au parent (WhatsApp)
              </a>
            ) : (
              <p className="text-[11px] text-slate-500">Aucun numéro WhatsApp enregistré pour le parent.</p>
            )}
            <p className="text-[10px] text-slate-400">Carte perdue ? Cherchez l’élève par nom ou matricule, vérifiez sa fiche, puis cochez « Présent ».</p>
          </div>
        )}
        {result && (
          <div className={`p-4 sm:p-5 rounded-3xl border shadow-xs space-y-3 ${result.already ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-16 rounded-xl overflow-hidden bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 font-extrabold shrink-0">
                  {result.student.avatar ? <img src={result.student.avatar} alt="" className="w-full h-full object-cover" /> : (result.student.firstName || '?')[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 break-words">{result.student.fullName}</p>
                  <p className="text-xs text-slate-600">{result.student.grade} • {result.student.studentNumber}</p>
                  <p className={`text-xs font-bold mt-0.5 flex items-center gap-1 ${result.already ? 'text-amber-800' : 'text-emerald-700'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {result.already ? `Déjà scanné à ${hhmm(result.at)}` : `Arrivé(e) à ${hhmm(result.at)}`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setResult(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-slate-200 text-xs space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Parent / tuteur</p>
              <p className="font-bold text-slate-900">{result.student.guardianName || '—'}</p>
              <p className="font-mono text-slate-700">{parentPhone(result.student) || 'Aucun numéro enregistré'}</p>
            </div>
            {waArrival(result.student, result.at) ? (
              <a
                href={waArrival(result.student, result.at)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markNotified(result.student)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1ebe5b] cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" /> Prévenir le parent sur WhatsApp
              </a>
            ) : (
              <p className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">Aucun numéro WhatsApp pour ce parent : renseignez-le dans la fiche de l’élève.</p>
            )}
            {mine(result.student.id)?.notifiedAt && (
              <p className="text-[11px] text-emerald-800">Parent averti à {hhmm(mine(result.student.id)!.notifiedAt!)}.</p>
            )}
          </div>
        )}

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 font-heading flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" /> Pas encore arrivés ({absentees.length})
          </h2>
          <p className="text-[11px] text-slate-500">Après le contrôle du matin, prévenez les parents des élèves non scannés.</p>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {absentees.length === 0 && <p className="py-4 text-xs text-slate-500 text-center">Tous les élèves ont été scannés.</p>}
            {absentees.map((s) => {
              const url = waAbsent(s);
              return (
                <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 break-words">{s.fullName}</p>
                    <p className="text-[11px] text-slate-500">{s.grade}</p>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#25D366] hover:bg-[#1ebe5b]">
                      <MessageCircle className="w-3.5 h-3.5" /> Absent
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 shrink-0">Pas de numéro</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
