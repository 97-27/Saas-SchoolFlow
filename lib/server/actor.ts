import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionPayload } from '@/lib/server/session';

/**
 * AUTEUR DES ACTIONS (journal, migration 007)
 * Chaque requête API retient qui l'a faite ; le client Supabase serveur (admin.ts) l'envoie
 * dans l'en-tête « x-sf-actor », que la base recopie dans data_journal. Format :
 * « rôle|identifiant du membre ». Le code d'accès n'y figure JAMAIS (c'est un secret).
 */
const actorStore = new AsyncLocalStorage<string>();

export function actorLabel(session: Pick<SessionPayload, 'roleId' | 'staffId'>): string {
  const role = (session.roleId || 'inconnu').replace(/[^a-z_]/gi, '');
  const staff = (session.staffId || '').replace(/[^\w-]/g, '').slice(0, 64);
  return staff ? `${role}|${staff}` : role;
}

/** À appeler dans une route API juste après la vérification de session. */
export function setRequestActor(session: Pick<SessionPayload, 'roleId' | 'staffId'>): void {
  actorStore.enterWith(actorLabel(session));
}

export function getRequestActor(): string | undefined {
  return actorStore.getStore();
}
