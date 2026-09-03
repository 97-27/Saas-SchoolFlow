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
 * Example: "2025-01-26" -> "26 janv. 2025"
 */
export function formatDateReadable(dateInput: string | Date): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
