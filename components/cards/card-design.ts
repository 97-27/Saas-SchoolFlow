/**
 * Carte scolaire : dessin (HTML + CSS) partagé par l'aperçu à l'écran et la feuille imprimée.
 * Format carte bancaire (85,6 × 54 mm). Recto : identité de l'élève ; verso : QR code + contacts.
 * Couleurs de SchoolFlow : vert (#047857), jaune (#f59e0b), noir (#0f172a) et blanc.
 * 5 élèves par page A4 : chaque ligne = la carte (recto) et son verso à côté.
 */
import type { School, Student } from '@/lib/data/types';

export const CARDS_PER_PAGE = 5;

/** Contenu du QR : repère de l'application, école, identifiant stable de l'élève (jamais son numéro, qui peut se décaler). */
export const QR_PREFIX = 'SFC1';
export const qrPayload = (slug: string, studentId: string) => `${QR_PREFIX}|${slug}|${studentId}`;
export function parseQrPayload(text: string): { slug: string; studentId: string } | null {
  const parts = String(text || '').trim().split('|');
  if (parts.length !== 3 || parts[0] !== QR_PREFIX || !parts[1] || !parts[2]) return null;
  return { slug: parts[1], studentId: parts[2] };
}

export const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Date de naissance 12/05/2015 : la valeur par défaut de l'application (2015-05-12) n'est pas une vraie date. */
export const DEFAULT_BIRTH = '2015-05-12';
export const hasRealBirthDate = (s: Student) => !!s.dateOfBirth && s.dateOfBirth !== DEFAULT_BIRTH;
export function frDate(iso?: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Numéro WhatsApp international (Côte d'Ivoire par défaut), chiffres seulement. */
export function whatsappNumber(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('225') || digits.length > 10 ? digits : `225${digits}`;
}

export const schoolContact = (school: School) => school.phone || school.receiptHeaderPhone || school.whatsappPhone || '';
export const parentPhone = (s: Student) => s.whatsappPhone || s.guardianPhone || '';

export const CARD_CSS = `
.sfc-page{width:100%;box-sizing:border-box;page-break-after:always;break-after:page}
.sfc-page:last-child{page-break-after:auto;break-after:auto}
.sfc-row{display:flex;justify-content:center;gap:3mm;margin-bottom:2.4mm;page-break-inside:avoid;break-inside:avoid}
.sfc{width:85.6mm;height:54mm;border:.25mm solid #0f172a;border-radius:3mm;overflow:hidden;position:relative;background:#fff;color:#0f172a;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;flex:none}
.sfc *{box-sizing:border-box}
.sfc-head{background:#047857;color:#fff;height:13.5mm;display:flex;align-items:center;gap:2mm;padding:0 2.5mm}
.sfc-logo{width:10mm;height:10mm;object-fit:contain;background:#fff;border-radius:50%;padding:.4mm;flex:none}
.sfc-logo-empty{width:10mm;height:10mm;flex:none}
.sfc-school{flex:1;text-align:center;line-height:1.15;min-width:0}
.sfc-school b{display:block;font-size:2.7mm;font-weight:800;letter-spacing:.1mm}
.sfc-school span{display:block;font-size:2mm;color:#fde68a;font-weight:700;margin-top:.3mm}
.sfc-stripe{height:1.2mm;background:#f59e0b}
.sfc-body{display:flex;gap:2.5mm;padding:2mm 2.5mm 0}
.sfc-photo{width:18mm;height:23mm;border:.3mm solid #047857;border-radius:1.5mm;background:#ecfdf5;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;color:#047857;font-weight:800;font-size:6mm}
.sfc-photo img{width:100%;height:100%;object-fit:cover}
.sfc-info{flex:1;min-width:0}
.sfc-title{font-size:2.1mm;font-weight:800;color:#047857;letter-spacing:.35mm;margin-bottom:.8mm}
.sfc-name{font-size:3.5mm;font-weight:800;text-transform:uppercase;line-height:1.1;word-break:break-word}
.sfc-first{font-size:3mm;font-weight:700;line-height:1.15;margin-bottom:1mm;word-break:break-word}
.sfc-line{font-size:2.3mm;line-height:1.4}
.sfc-line i{font-style:normal;color:#475569}
.sfc-foot{position:absolute;left:0;right:0;bottom:0;background:#0f172a;color:#fff;font-size:2mm;padding:1mm 2.5mm;display:flex;justify-content:space-between;gap:2mm}
.sfc-foot span:last-child{color:#fde68a;font-weight:700}
.sfc-vhead{background:#047857;color:#fff;text-align:center;font-size:2.4mm;font-weight:800;padding:1.3mm 2mm;letter-spacing:.35mm}
.sfc-vbody{display:flex;gap:2.5mm;padding:1.8mm 2.5mm 0;align-items:flex-start}
.sfc-qr{width:31mm;height:31mm;flex:none;border:.3mm solid #0f172a;border-radius:1.5mm;padding:.6mm;background:#fff}
.sfc-qr img{width:100%;height:100%;display:block}
.sfc-vinfo{flex:1;min-width:0;font-size:2.25mm;line-height:1.4}
.sfc-vinfo b{display:block;color:#047857;font-size:2.1mm;letter-spacing:.2mm;margin-top:1mm}
.sfc-vinfo b:first-child{margin-top:0}
.sfc-lost{position:absolute;left:0;right:0;bottom:0;background:#f59e0b;color:#0f172a;font-size:2.05mm;font-weight:800;text-align:center;padding:1.1mm 2mm;line-height:1.25}
`;

function initials(s: Student) {
  return ((s.firstName || s.fullName || '?')[0] || '?').toUpperCase() + ((s.lastName || '')[0] || '').toUpperCase();
}

export function cardRectoHtml(s: Student, school: School): string {
  const first = s.firstName || '';
  const last = s.lastName || (s.fullName || '').replace(first, '').trim() || s.fullName || '';
  const born = hasRealBirthDate(s) ? frDate(s.dateOfBirth) : '';
  const dots = '.................';
  const fullName = school.receiptHeaderFullName || school.name;
  const sigle = school.shortName && school.shortName !== fullName ? school.shortName : '';
  const logo = school.logoUrl ? `<img class="sfc-logo" src="${esc(school.logoUrl)}" alt="">` : '<div class="sfc-logo-empty"></div>';
  const emblem = school.countryEmblemUrl ? `<img class="sfc-logo" src="${esc(school.countryEmblemUrl)}" alt="">` : '<div class="sfc-logo-empty"></div>';
  const photo = s.avatar ? `<img src="${esc(s.avatar)}" alt="">` : esc(initials(s));
  return `<div class="sfc">
  <div class="sfc-head">${logo}<div class="sfc-school"><b>${esc(fullName.toUpperCase())}</b><span>${esc(sigle)}${sigle && school.academicYear ? ' • ' : ''}${esc(school.academicYear || '')}</span></div>${emblem}</div>
  <div class="sfc-stripe"></div>
  <div class="sfc-body">
    <div class="sfc-photo">${photo}</div>
    <div class="sfc-info">
      <div class="sfc-title">CARTE SCOLAIRE</div>
      <div class="sfc-name">${esc(last)}</div>
      <div class="sfc-first">${esc(first)}</div>
      <div class="sfc-line"><i>Né(e) le :</i> <b>${esc(born || dots)}</b></div>
      <div class="sfc-line"><i>à :</i> <b>${esc(s.placeOfBirth || dots)}</b></div>
      <div class="sfc-line"><i>Classe :</i> <b>${esc(s.grade || '')}</b></div>
    </div>
  </div>
  <div class="sfc-foot"><span>${esc(school.directorName ? `Directeur : ${school.directorName}` : '')}</span><span>${esc(schoolContact(school))}</span></div>
</div>`;
}

export function cardVersoHtml(s: Student, school: School, qrDataUrl: string): string {
  const qr = qrDataUrl ? `<img src="${esc(qrDataUrl)}" alt="QR">` : '';
  const parent = parentPhone(s);
  return `<div class="sfc">
  <div class="sfc-vhead">${esc((school.shortName || school.name).toUpperCase())} • CARTE SCOLAIRE</div>
  <div class="sfc-vbody">
    <div class="sfc-qr">${qr}</div>
    <div class="sfc-vinfo">
      <b>PARENT / TUTEUR</b>
      ${esc(s.guardianName || '—')}<br>${esc(parent || '—')}
      <b>CONTACT DE L’ÉCOLE</b>
      ${esc(schoolContact(school) || '—')}${school.address ? `<br>${esc(school.address)}` : ''}${school.city ? `<br>${esc(school.city)}` : ''}
    </div>
  </div>
  <div class="sfc-lost">En cas de perte, merci de rapporter cette carte à l’établissement.</div>
</div>`;
}

/** Feuilles A4 : 5 élèves par page, chacun avec sa carte (recto) et son verso à côté. */
export function sheetsHtml(list: Student[], school: School, qrs: Record<string, string>): string {
  const pages: string[] = [];
  for (let i = 0; i < list.length; i += CARDS_PER_PAGE) {
    const rows = list
      .slice(i, i + CARDS_PER_PAGE)
      .map((s) => `<div class="sfc-row">${cardRectoHtml(s, school)}${cardVersoHtml(s, school, qrs[s.id] || '')}</div>`)
      .join('');
    pages.push(`<div class="sfc-page">${rows}</div>`);
  }
  return pages.join('');
}

export function printDocumentHtml(body: string, title: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:A4;margin:6mm}html,body{margin:0;padding:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}${CARD_CSS}</style></head><body>${body}</body></html>`;
}
