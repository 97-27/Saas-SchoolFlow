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
