/**
 * Formats a numeric amount in FCFA with thin spaces between thousands
 * Example: 250000 -> "250 000 FCFA"
 */
export function formatFCFA(amount: number): string {
  if (isNaN(amount)) return '0\u00A0FCFA';
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted}\u00A0FCFA`;
}

/**
 * Formats an ISO date string or Date object into strict French JJ/MM/AAAA format
 * Example: "2026-09-20" -> "20/09/2026"
 * Handles YYYY-MM-DD strings directly without timezone shift errors.
 */
export function formatDate(dateInput: string | Date): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // If format is already DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
    // If format is YYYY-MM-DD
    const parts = trimmed.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formats date into a short human-readable French format
 * Example: "2026-08-27" -> "27 août 2026"
 */
export function formatDateReadable(dateInput: string | Date): string {
  return formatDateFrenchLong(dateInput);
}

/**
 * Formats date into full French format: "Jour Mois Année"
 * Example: "2026-08-27" -> "27 août 2026"
 */
export function formatDateFrenchLong(dateInput: string | Date): string {
  if (!dateInput) return '';
  let d: Date;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      d = new Date(Number(year), Number(month) - 1, Number(day));
    } else if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [year, month, day] = trimmed.split('T')[0].split('-');
      d = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      d = new Date(trimmed);
    }
  } else {
    d = dateInput;
  }
  if (isNaN(d.getTime())) return String(dateInput);

  const MONTHS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Formats date with weekday in French: "Jeudi 27 août 2026"
 */
export function formatDateWithWeekday(dateInput: string | Date): string {
  if (!dateInput) return '';
  let d: Date;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      d = new Date(Number(year), Number(month) - 1, Number(day));
    } else if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [year, month, day] = trimmed.split('T')[0].split('-');
      d = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      d = new Date(trimmed);
    }
  } else {
    d = dateInput;
  }
  if (isNaN(d.getTime())) return String(dateInput);

  const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const MONTHS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Splits a full name into Family Name (uppercase) and First Names,
 * adhering strictly to West African naming standards (Family Name first).
 * Examples:
 * - "KONATE Lassina Mouhamed" -> { lastName: "KONATE", firstName: "Lassina Mouhamed" }
 * - "KOUASSI KOUADIO Jean" -> { lastName: "KOUASSI KOUADIO", firstName: "Jean" }
 * - "Lassina Mouhamed KONATE" -> { lastName: "KONATE", firstName: "Lassina Mouhamed" }
 * - "Traoré" -> { lastName: "TRAORÉ", firstName: "" }
 */
export function splitFullNameNomFirst(fullName?: string): { lastName: string; firstName: string } {
  if (!fullName) return { lastName: '', firstName: '' };
  const clean = fullName.trim();
  if (!clean) return { lastName: '', firstName: '' };

  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0].toUpperCase(), firstName: '' };
  }

  const isAllUpper = (word: string) => {
    const lettersOnly = word.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    return lettersOnly.length > 0 && lettersOnly === lettersOnly.toUpperCase();
  };

  // If the last word is all uppercase and first word is not (e.g. "Lassina Mouhamed KONATE")
  if (isAllUpper(parts[parts.length - 1]) && !isAllUpper(parts[0])) {
    let splitIdx = parts.length - 1;
    while (splitIdx > 0 && isAllUpper(parts[splitIdx - 1])) {
      splitIdx--;
    }
    const lastName = parts.slice(splitIdx).join(' ').toUpperCase();
    const firstName = parts.slice(0, splitIdx).join(' ');
    return { lastName, firstName };
  }

  // Standard African format: Family name first (e.g. "KONATE Lassina Mouhamed")
  let splitIdx = 1;
  while (splitIdx < parts.length - 1 && isAllUpper(parts[splitIdx])) {
    splitIdx++;
  }
  const lastName = parts.slice(0, splitIdx).join(' ').toUpperCase();
  const firstName = parts.slice(splitIdx).join(' ');
  return { lastName, firstName };
}

/**
 * Formats a student full name so that the Family Name is ALWAYS first and uppercase,
 * followed by the first names.
 * Example: "Lassina Mouhamed KONATE" -> "KONATE Lassina Mouhamed"
 */
export function formatFullNameNomFirst(fullName?: string): string {
  if (!fullName) return '—';
  const { lastName, firstName } = splitFullNameNomFirst(fullName);
  if (!lastName && !firstName) return '—';
  return `${lastName} ${firstName}`.trim();
}

/**
 * Cleans any legacy metadata or code artifacts from an address string.
 * Strips [SF_META:...], ,"notes":"..."}], and stray JSON syntax.
 * Example: 'Anyama ,"notes":""}] [SF_META:{"enrollmentDate":...}]' -> 'Anyama'
 */
export function cleanDisplayAddress(address?: string | null): string {
  if (!address) return '';
  let cleaned = String(address);
  // Remove [SF_META:...]. The blob is always appended once at the very end of the address
  // (see batchUpsertStudents in lib/supabase/services.ts), so it must be matched greedily
  // to the end of the string. A non-greedy match stopping at the FIRST "]" used to cut the
  // JSON short whenever it contained its own array (e.g. an empty "secondaryPhones":[]),
  // leaving the rest of the JSON as stray "key:value" text baked permanently into the
  // "clean" address on every subsequent save (visible as ",isBoarding:false" etc.).
  cleaned = cleaned.replace(/\s*\[SF_META:[\s\S]*\]\s*$/, '');
  // Remove legacy notes fragments like ,"notes":"..."}] or ,"notes":""}]
  cleaned = cleaned.replace(/,?\s*["']?notes["']?\s*:\s*["'][^"']*["']\s*\}?\]?/gi, '');
  // Self-heal stray metadata fragments already baked into stored addresses by the bug above
  // on records saved before this fix (no DB migration needed — cleaned again on every read).
  cleaned = cleaned.replace(/,?\s*(enrollmentDate|paymentDate|installments|updatedAt|secondaryPhones|isBoarding)\s*:\s*[^,]*/gi, '');
  // Strip trailing JSON symbols
  cleaned = cleaned.replace(/[\[\]\{\}"]/g, '');
  // Strip trailing commas, spaces
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  return cleaned;
}

/**
 * Returns strictly agreed gender labels for student enrollment status.
 * Male: "Nouveau" / "Ancien"
 * Female: "Nouvelle" / "Ancienne"
 */
export function formatEnrollmentStatus(enrollmentType?: string | null, gender?: 'male' | 'female' | string | null): {
  label: string;
  badge: string;
  isFemale: boolean;
  isAncien: boolean;
} {
  const isFemale = (gender || '').toLowerCase() === 'female';
  const isAncien = enrollmentType === 'ancien';
  const label = isAncien
    ? (isFemale ? 'Ancienne' : 'Ancien')
    : (isFemale ? 'Nouvelle' : 'Nouveau');
  const badge = isAncien
    ? (isFemale ? '🔄 Ancienne' : '🔄 Ancien')
    : (isFemale ? '🌟 Nouvelle' : '🌟 Nouveau');

  return { label, badge, isFemale, isAncien };
}

