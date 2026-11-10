/**
 * Pointage du personnel : types et règles partagés entre la page (navigateur) et la route
 * /api/pointage (serveur). Aucun import serveur ici.
 */

export type PointageConfig = {
  /** Activé par la Direction (Fondateur, Fondateur adjoint, Directeur). */
  enabled: boolean;
  /** Plage d'arrivée « HH:MM » (heure de l'établissement). */
  arrivalStart: string;
  arrivalEnd: string;
  /** Plage de départ. */
  departureStart: string;
  departureEnd: string;
  /** Jours de pointage : 0 = dimanche … 6 = samedi. */
  workDays: number[];
  /** Position de l'école (enregistrée sur place par la Direction) ; null = pas de contrôle. */
  location: { lat: number; lng: number; setAt?: string } | null;
  /** Distance maximale autorisée autour de l'école, en mètres. */
  radiusMeters: number;
  /** Fuseau horaire de l'établissement. */
  timezone: string;
};

export const DEFAULT_POINTAGE_CONFIG: PointageConfig = {
  enabled: false,
  arrivalStart: '07:00',
  arrivalEnd: '07:30',
  departureStart: '16:00',
  departureEnd: '17:30',
  workDays: [1, 2, 3, 4, 5],
  location: null,
  radiusMeters: 200,
  timezone: 'Africa/Abidjan',
};

export type PointageStamp = { at: string; time: string; lat?: number; lng?: number; accuracy?: number; distance?: number };

export type PointageRecord = {
  staffId: string;
  fullName?: string;
  roleId?: string;
  arrival?: PointageStamp;
  departure?: PointageStamp;
  absence?: { reason: string; at: string; by: 'self' | 'direction' };
};

export type PointageStatus = 'present' | 'parti' | 'absent_justifie' | 'absent' | 'en_attente' | 'non_travaille';

export const STATUS_LABELS: Record<PointageStatus, string> = {
  present: 'Présent',
  parti: 'Présent • parti',
  absent_justifie: 'Absent (motif)',
  absent: 'Absent',
  en_attente: 'Pas encore pointé',
  non_travaille: 'Jour non travaillé',
};

export const WEEKDAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const isValidHHMM = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Date « AAAA-MM-JJ », heure « HH:MM » et jour de la semaine dans le fuseau de l'école. */
export function schoolClock(timezone: string, at: Date = new Date()): { date: string; time: string; weekday: number } {
  let tz = timezone || 'Africa/Abidjan';
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
  } catch {
    tz = 'Africa/Abidjan';
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    weekday: days[get('weekday')] ?? at.getDay(),
  };
}

/** Distance entre deux points GPS, en mètres (formule de haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Statut d'une personne pour un jour donné. */
export function dayStatus(
  rec: PointageRecord | null | undefined,
  config: PointageConfig,
  date: string,
  clock: { date: string; time: string }
): PointageStatus {
  if (rec?.arrival) return rec.departure ? 'parti' : 'present';
  if (rec?.absence) return 'absent_justifie';
  if (!config.workDays.includes(weekdayOf(date))) return 'non_travaille';
  if (date < clock.date) return 'absent';
  if (date === clock.date && clock.time > config.arrivalEnd) return 'absent';
  return 'en_attente';
}
