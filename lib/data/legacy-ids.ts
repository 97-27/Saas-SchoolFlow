/**
 * Identifiants des 15 anciens « élèves de démonstration » (mockStudents). Ils dupliquaient les
 * vrais élèves ID-001 à ID-015 d'EPC MANOI sous un autre identifiant, et des navigateurs les ont
 * encore en mémoire locale : sans ce filtre, la moindre synchronisation les renverrait en base et
 * recréerait les doublons. Le serveur les refuse et le navigateur les ignore.
 */
export const LEGACY_DEMO_STUDENT_IDS = new Set<string>([
  '2f3af897-b354-47b6-a800-c3419c59ec8f',
  '1b170bd6-389c-4fe0-944c-4868b0a8599b',
  '61c785b4-be9d-4a35-8b02-66ceffecccdf',
  '4675d6cc-e2e1-4b41-b53f-51a15e3caf06',
  '72c96d59-13df-4706-aefa-7bed85ca5138',
  '32f145bd-eb60-4b2a-b3cb-ea6880ac8378',
  '890eca4a-f225-4055-8b70-8dd0919d6de4',
  'e3df83e2-4732-4225-8efe-b56d868949f2',
  '16f38872-8b28-41f2-a62d-97971cfbcf15',
  'a52bd665-0a9e-4a51-9def-b3d57ed39131',
  '1759e059-c2b7-449f-95aa-d2235c09c88a',
  '5b3a4413-c77e-4c49-bfaa-55bf71b6af1d',
  '701e331e-b9eb-4e57-8a5e-b065f38d71d2',
  'a8540b89-b812-448f-9e53-c12d7dea0b4f',
  '5403c5e0-f2bb-482d-ac6f-a8443c038da3',
]);

/** Anciennes factures de démonstration (identifiants non UUID « inv-001 » à « inv-015 »). */
export const LEGACY_DEMO_INVOICE_IDS = new Set<string>(
  Array.from({ length: 15 }, (_, i) => `inv-${String(i + 1).padStart(3, '0')}`)
);

export function isLegacyDemoStudent(s: { id?: string } | null | undefined): boolean {
  return Boolean(s?.id && LEGACY_DEMO_STUDENT_IDS.has(s.id));
}

export function isLegacyDemoInvoice(inv: { id?: string; studentId?: string } | null | undefined): boolean {
  return Boolean(
    inv && ((inv.id && LEGACY_DEMO_INVOICE_IDS.has(inv.id)) || (inv.studentId && LEGACY_DEMO_STUDENT_IDS.has(inv.studentId)))
  );
}
