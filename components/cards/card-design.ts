/**
 * Carte scolaire : dessin (HTML + CSS) partagé par l'aperçu à l'écran et la feuille imprimée.
 * Format carte bancaire (85,6 × 54 mm). Recto : identité de l'élève ; verso : QR code + contacts.
 * Couleurs de SchoolFlow : vert (#047857), jaune (#f59e0b), noir (#0f172a) et blanc.
 * 5 élèves par page A4 : chaque ligne = la carte (recto) et son verso à côté.
 */
import type { School, Student } from '@/lib/data/types';
import { schoolPhones } from '@/lib/data/school-phones';

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

/** Numéros de l'école : le principal d'abord, puis les autres (Paramètres → numéros 1, 2, 3). */
export const schoolContacts = (school: School): string[] => {
  const list = schoolPhones(school);
  return list.length ? list : school.whatsappPhone ? [school.whatsappPhone] : [];
};
export const schoolContact = (school: School) => schoolContacts(school)[0] || '';
export const parentPhone = (s: Student) => s.whatsappPhone || s.guardianPhone || '';

/** Cycles enseignés (mêmes valeurs par défaut que les Paramètres). */
export function schoolCycles(school: School): string[] {
  const out: string[] = [];
  if (school.hasMaternelle ?? true) out.push('Maternelle');
  if (school.hasPrimaire ?? true) out.push('Primaire');
  if (school.hasCollege ?? true) out.push('Collège');
  if (school.hasLycee ?? false) out.push('Lycée');
  return out;
}

export const CARD_CSS = `
.sfc-page{width:100%;box-sizing:border-box;page-break-after:always;break-after:page}
.sfc-page:last-child{page-break-after:auto;break-after:auto}
.sfc-row{display:flex;justify-content:center;gap:3mm;margin-bottom:2.4mm;page-break-inside:avoid;break-inside:avoid}
.sfc{width:85.6mm;height:54mm;border:.25mm solid #0f172a;border-radius:3mm;overflow:hidden;position:relative;background:#fff;color:#0f172a;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;flex:none}
.sfc *{box-sizing:border-box}
.sfc-head{background:#047857;color:#fff;height:11.5mm;display:flex;align-items:center;gap:1.6mm;padding:0 2mm}
.sfc-logo{width:9mm;height:9mm;object-fit:contain;background:#fff;border-radius:50%;padding:.35mm;flex:none}
.sfc-logo-empty{width:9mm;height:9mm;flex:none}
.sfc-school{flex:1;text-align:center;line-height:1.15;min-width:0;overflow:hidden}
.sfc-school b{display:block;white-space:nowrap;font-weight:800;letter-spacing:.05mm}
.sfc-school span{display:block;white-space:nowrap;font-size:2mm;color:#fde68a;font-weight:700;margin-top:.35mm;overflow:hidden;text-overflow:ellipsis}
.sfc-stripe{height:1mm;background:#f59e0b}
.sfc-band{background:#ecfdf5;color:#047857;font-size:1.9mm;font-weight:800;text-align:center;padding:.6mm 2mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:.2mm solid #a7f3d0}
.sfc-body{display:flex;gap:2.5mm;padding:1.6mm 2.5mm 0}
.sfc-photo{width:22mm;height:29mm;border:.3mm solid #047857;border-radius:1.5mm;background:#ecfdf5;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;color:#047857;font-weight:800;font-size:7mm}
.sfc-photo img{width:100%;height:100%;object-fit:cover}
.sfc-info{flex:1;min-width:0}
.sfc-title{font-size:2.5mm;font-weight:800;color:#047857;letter-spacing:.2mm;margin-bottom:1mm;text-align:center;white-space:nowrap;border-bottom:.3mm solid #f59e0b;padding-bottom:.5mm}
.sfc-line{font-size:2.5mm;line-height:1.38;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sfc-line i{font-style:normal;color:#475569}
.sfc-line b{font-weight:800}
.sfc-foot{position:absolute;left:0;right:0;bottom:0;background:#0f172a;color:#fff;font-size:2mm;padding:1mm 2.5mm;display:flex;justify-content:space-between;gap:2mm;white-space:nowrap}
.sfc-foot span{overflow:hidden;text-overflow:ellipsis}
.sfc-foot span:last-child{color:#fde68a;font-weight:700}
.sfc-vhead{background:#047857;color:#fff;text-align:center;font-weight:800;padding:1.3mm 2mm;letter-spacing:.2mm;white-space:nowrap;overflow:hidden}
.sfc-vbody{display:flex;gap:2.5mm;padding:1.6mm 2.5mm 0;align-items:flex-start}
.sfc-qr{width:37mm;height:37mm;flex:none;border:.3mm solid #0f172a;border-radius:1.5mm;padding:.6mm;background:#fff}
.sfc-qr img{width:100%;height:100%;display:block}
.sfc-vinfo{flex:1;min-width:0;font-size:2.5mm;line-height:1.35}
.sfc-vinfo b{display:block;color:#047857;font-size:2.2mm;letter-spacing:.15mm;margin-top:1.2mm}
.sfc-vinfo b:first-child{margin-top:0}
.sfc-vinfo div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sfc-vinfo .n{font-weight:800}
.sfc-lost{position:absolute;left:0;right:0;bottom:0;background:#f59e0b;color:#0f172a;font-size:2.1mm;font-weight:800;text-align:center;padding:1mm 2mm;line-height:1.25}
`;

function initials(s: Student) {
  return ((s.firstName || s.fullName || '?')[0] || '?').toUpperCase() + ((s.lastName || '')[0] || '').toUpperCase();
}

/** Taille de police (mm) pour que le nom entier de l'école tienne sur UNE seule ligne (~52 mm disponibles). */
function nameFontMm(name: string): number {
  const len = Math.max(name.length, 1);
  return Math.max(1.35, Math.min(2.9, 52 / (len * 0.66)));
}

export function cardRectoHtml(s: Student, school: School): string {
  const first = s.firstName || '';
  const last = s.lastName || (s.fullName || '').replace(first, '').trim() || s.fullName || '';
  const born = hasRealBirthDate(s) ? frDate(s.dateOfBirth) : '';
  const dots = '.......';
  const fullName = (school.receiptHeaderFullName || school.name || '').toUpperCase();
  const sigle = school.shortName && school.shortName.toUpperCase() !== fullName ? school.shortName : '';
  const slogan = school.receiptHeaderSlogan || school.slogan || '';
  const approval = (school.approvalNumber || '').trim();
  const cycles = schoolCycles(school).join(' • ');
  const logo = school.logoUrl ? `<img class="sfc-logo" src="${esc(school.logoUrl)}" alt="">` : '<div class="sfc-logo-empty"></div>';
  const emblem = school.countryEmblemUrl ? `<img class="sfc-logo" src="${esc(school.countryEmblemUrl)}" alt="">` : '<div class="sfc-logo-empty"></div>';
  const photo = s.avatar ? `<img src="${esc(s.avatar)}" alt="">` : esc(initials(s));
  const sub = [sigle, slogan].filter(Boolean).join(' — ');
  const band = [approval ? `Agrément : ${approval}` : '', cycles].filter(Boolean).join('  |  ');
  const year = school.academicYear || '';
  return `<div class="sfc">
  <div class="sfc-head">${logo}<div class="sfc-school"><b style="font-size:${nameFontMm(fullName).toFixed(2)}mm">${esc(fullName)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${emblem}</div>
  <div class="sfc-stripe"></div>
  ${band ? `<div class="sfc-band">${esc(band)}</div>` : ''}
  <div class="sfc-body">
    <div class="sfc-photo">${photo}</div>
    <div class="sfc-info">
      <div class="sfc-title">CARTE SCOLAIRE${year ? ` : ${esc(year)}` : ''}</div>
      <div class="sfc-line"><i>Nom :</i> <b>${esc(String(last).toUpperCase())}</b></div>
      <div class="sfc-line"><i>Prénom :</i> <b>${esc(first)}</b></div>
      <div class="sfc-line"><i>Né(e) le</i> <b>${esc(born || dots)}</b> <i>à</i> <b>${esc(s.placeOfBirth || dots)}</b></div>
      <div class="sfc-line"><i>Domicile :</i> <b>${esc(s.address || dots)}</b></div>
      <div class="sfc-line"><i>Classe :</i> <b>${esc(s.grade || '')}</b></div>
    </div>
  </div>
  <div class="sfc-foot"><span>${esc(school.directorName ? `Directeur : ${school.directorName}` : '')}</span><span>${esc(schoolContact(school))}</span></div>
</div>`;
}

export function cardVersoHtml(s: Student, school: School, qrDataUrl: string): string {
  const qr = qrDataUrl ? `<img src="${esc(qrDataUrl)}" alt="QR">` : '';
  const parent = parentPhone(s);
  const title = `${(school.shortName || school.name).toUpperCase()} • CARTE SCOLAIRE`;
  const phones = schoolContacts(school);
  return `<div class="sfc">
  <div class="sfc-vhead" style="font-size:${Math.max(1.6, Math.min(2.5, 78 / (Math.max(title.length, 1) * 0.66))).toFixed(2)}mm">${esc(title)}</div>
  <div class="sfc-vbody">
    <div class="sfc-qr">${qr}</div>
    <div class="sfc-vinfo">
      <b>PARENT / TUTEUR</b>
      <div class="n">${esc(s.guardianName || '—')}</div>
      <div>${esc(parent || '—')}</div>
      <b>CONTACTS DE L’ÉCOLE</b>
      ${phones.length ? phones.map((p) => `<div>${esc(p)}</div>`).join('') : '<div>—</div>'}
      ${school.city ? `<div>${esc(school.address || school.city)}</div>` : ''}
    </div>
  </div>
  <div class="sfc-lost">En cas de perte, merci de rapporter cette carte à l’établissement.</div>
</div>`;
}

/** Feuilles A4 : 5 élèves par page, chacun avec sa carte (recto) et son verso à côté. */
export function sheetsHtml(list: Student[], school: School, qrs: Record<string, string>): string {
  return pagesHtml(list, school, qrs).join('');
}

/** Une chaîne HTML par page (5 élèves chacune). */
export function pagesHtml(list: Student[], school: School, qrs: Record<string, string>): string[] {
  const pages: string[] = [];
  for (let i = 0; i < list.length; i += CARDS_PER_PAGE) {
    const rows = list
      .slice(i, i + CARDS_PER_PAGE)
      .map((s) => `<div class="sfc-row">${cardRectoHtml(s, school)}${cardVersoHtml(s, school, qrs[s.id] || '')}</div>`)
      .join('');
    pages.push(`<div class="sfc-page">${rows}</div>`);
  }
  return pages;
}

export function printDocumentHtml(body: string, title: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:A4;margin:6mm}html,body{margin:0;padding:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}${CARD_CSS}</style></head><body>${body}</body></html>`;
}
