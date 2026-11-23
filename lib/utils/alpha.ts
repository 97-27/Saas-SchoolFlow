/**
 * Ordre alphabétique (A → Z) des élèves : nom de famille puis prénoms, sans tenir compte des
 * accents ni des majuscules. Utilisé partout où une liste d'élèves est affichée.
 */
type NamedStudent = { lastName?: string; firstName?: string; fullName?: string };

function keyOf(s: NamedStudent): string {
  const last = (s.lastName || '').trim();
  const first = (s.firstName || '').trim();
  return (last || first ? `${last} ${first}` : s.fullName || '').trim();
}

export function compareStudentsAlpha(a: NamedStudent, b: NamedStudent): number {
  return keyOf(a).localeCompare(keyOf(b), 'fr', { sensitivity: 'base' });
}

export function sortStudentsAlpha<T extends NamedStudent>(list: readonly T[]): T[] {
  return [...list].sort(compareStudentsAlpha);
}
