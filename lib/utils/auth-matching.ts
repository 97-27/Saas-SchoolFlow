import { Student } from '@/lib/data/types';

/**
 * Règles de correspondance utilisées à la connexion (noms officiels, tuteurs, téléphones).
 * Fonctions pures, sans accès au navigateur : partagées entre live-store.ts (affichage) et la
 * route serveur /api/auth/login, qui est désormais la SEULE à décider d'une connexion.
 */

/**
 * Helper de comparaison intelligente de noms (insensible aux civilités, accents, casse, et ordre).
 * Permet de valider "LAWANI MOUHAMED" face à "Mouhamed Lawani" ou "M. LAWANI Mouhamed".
 */
export function areNamesMatching(input: string, official: string): boolean {
  if (!input || !official) return false;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

  const HONORIFICS = new Set([
    'm', 'mr', 'mme', 'mlle', 'madame', 'monsieur', 'dr', 'docteur',
    'prof', 'professeur', 'frere', 'soeur', 'pasteur', 'imam', 'maitre',
    'directeur', 'directrice', 'fondateur', 'fondatrice', 'general', 'generale'
  ]);

  const inputTokens = normalize(input)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !HONORIFICS.has(t));

  const officialTokens = normalize(official)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !HONORIFICS.has(t));

  if (inputTokens.length === 0 || officialTokens.length === 0) return false;

  const inputSet = new Set(inputTokens);
  const officialSet = new Set(officialTokens);

  // Tous les mots officiels sont présents dans la saisie ou inversement
  const officialInInput = officialTokens.every((t) => inputSet.has(t));
  const inputInOfficial = inputTokens.every((t) => officialSet.has(t));
  if (officialInInput || inputInOfficial) return true;

  // Au moins 2 mots clés majeurs correspondent
  const commonTokens = inputTokens.filter((t) => officialSet.has(t));
  if (commonTokens.length >= 2) return true;
  if (commonTokens.length >= 1 && (inputTokens.length === 1 || officialTokens.length === 1)) return true;

  return false;
}

/** Tous les numéros enregistrés pour un élève (jusqu'à 3, éventuellement combinés par / ; , ou "ou"). */
export function getStudentPhones(stu: Student): string[] {
  const registeredCandidates: string[] = [
    stu.whatsappPhone || '',
    stu.guardianPhone || '',
    ...(stu.secondaryPhones || []),
  ].filter(Boolean);

  const allPhones: string[] = [];
  for (const item of registeredCandidates) {
    const parts = item.split(/[/;,|]|\bou\b/i).map((p) => p.trim()).filter(Boolean);
    allPhones.push(...parts);
  }
  return allPhones;
}

/**
 * Vérifie si le numéro saisi par le parent correspond à l'un des numéros enregistrés pour l'élève
 * (Prend en compte jusqu'à 3 numéros : whatsappPhone, guardianPhone, secondaryPhones, avec ou sans indicatif valide).
 * Rejette catégoriquement tout faux indicatif de pays.
 */
export function checkPhoneMatchesStudent(inputRawPhone: string, stu: Student): boolean {
  if (!inputRawPhone || !stu) return false;
  const rawInput = inputRawPhone.trim();
  const inputDigits = rawInput.replace(/\D/g, '');
  if (inputDigits.length < 8) return false;

  const allPhones = getStudentPhones(stu);

  const hasExplicitPrefix = rawInput.startsWith('+') || rawInput.startsWith('00');
  let inputPrefix = '';
  if (rawInput.startsWith('+225') || rawInput.startsWith('00225') || inputDigits.startsWith('225')) {
    inputPrefix = '225';
  } else if (rawInput.startsWith('+221') || rawInput.startsWith('00221') || inputDigits.startsWith('221')) {
    inputPrefix = '221';
  } else if (rawInput.startsWith('+229') || rawInput.startsWith('00229') || inputDigits.startsWith('229')) {
    inputPrefix = '229';
  } else if (rawInput.startsWith('+226') || rawInput.startsWith('00226') || inputDigits.startsWith('226')) {
    inputPrefix = '226';
  } else if (rawInput.startsWith('+33') || rawInput.startsWith('0033')) {
    inputPrefix = '33';
  }

  for (const regStr of allPhones) {
    const regDigits = regStr.replace(/\D/g, '');
    if (regDigits.length < 8) continue;

    let regPrefix = '';
    if (regStr.startsWith('+225') || regStr.startsWith('00225') || regDigits.startsWith('225')) {
      regPrefix = '225';
    } else if (regStr.startsWith('+221') || regStr.startsWith('00221') || regDigits.startsWith('221')) {
      regPrefix = '221';
    } else if (regStr.startsWith('+229') || regStr.startsWith('00229') || regDigits.startsWith('229')) {
      regPrefix = '229';
    } else if (regStr.startsWith('+226') || regStr.startsWith('00226') || regDigits.startsWith('226')) {
      regPrefix = '226';
    }

    // Faux indicatif interdit : si l'utilisateur a saisi un indicatif explicite différent de celui de l'école/enregistré
    if (hasExplicitPrefix && inputPrefix && regPrefix && inputPrefix !== regPrefix) {
      continue;
    }

    // 1. Correspondance exacte des chiffres
    if (inputDigits === regDigits) return true;

    // 2. Correspondance sans préfixe pays
    const inputNational = inputPrefix && inputDigits.startsWith(inputPrefix)
      ? inputDigits.slice(inputPrefix.length)
      : inputDigits;
    const regNational = regPrefix && regDigits.startsWith(regPrefix)
      ? regDigits.slice(regPrefix.length)
      : regDigits;

    if (inputNational === regNational) return true;

    // 3. Correspondance avec ou sans 0 initial (ex: 0748921100 vs 748921100)
    if (inputNational.replace(/^0+/, '') === regNational.replace(/^0+/, '')) return true;

    // 4. Correspondance sur les 8 derniers chiffres
    if (inputNational.length >= 8 && regNational.length >= 8) {
      if (inputNational.slice(-8) === regNational.slice(-8)) return true;
    }
  }

  return false;
}

const GUARDIAN_HONORIFICS = new Set([
  'm', 'mr', 'mme', 'mlle', 'madame', 'monsieur', 'dr', 'docteur', 'pasteur', 'imam', 'maitre',
  'prof', 'professeur', 'famille', 'pere', 'mere', 'tuteur', 'tutrice', 'de', 'du', 'la', 'le', 'des',
]);

function guardianTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .split(/[\s,.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !GUARDIAN_HONORIFICS.has(t));
}

/**
 * Le parent doit saisir entièrement et mot pour mot le nom du tuteur enregistré (ordre libre) :
 * la saisie du prénom seul ou du nom de famille seul est refusée.
 */
export function isGuardianNameExactMatch(input: string, guardianName: string): boolean {
  const inputT = guardianTokens(input || '');
  const gT = guardianTokens(guardianName || '');
  if (gT.length === 0 || inputT.length === 0 || inputT.length !== gT.length) return false;
  return [...inputT].sort().join(' ') === [...gT].sort().join(' ');
}
