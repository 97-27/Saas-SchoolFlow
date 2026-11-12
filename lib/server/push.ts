import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { kvListPrefix, kvPut } from '@/lib/supabase/kv';

/**
 * NOTIFICATIONS EN ARRIÈRE-PLAN (Web Push)
 * Le téléphone / l'ordinateur reçoit l'alerte même si SchoolFlow est fermé : versement encaissé,
 * pointage d'un membre du personnel… Chaque appareil s'abonne (public/sw.js + /api/push), et
 * l'abonnement est gardé dans school_kv (clé privée, jamais lisible depuis un navigateur).
 *
 * Réglage Vercel (une fois) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
 * Sans ces variables, rien n'est envoyé et rien ne casse.
 */
export const PUSH_PREFIX = 'sf_private_push_';

export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  roleId: string;
  staffId: string;
  label: string;
  at: string;
};

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function pushPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || '';
}

/** Identifiant court et stable d'un abonnement (fin de l'endpoint, sans caractères spéciaux). */
export function pushKeyFor(staffId: string, endpoint: string): string {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) h = (h * 31 + endpoint.charCodeAt(i)) >>> 0;
  return `${PUSH_PREFIX}${staffId}_${h.toString(36)}`;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string; sound?: 'cash' | 'default' };

/**
 * Envoie une notification à tous les appareils abonnés des postes indiqués (sauf l'auteur).
 * Ne renvoie jamais d'erreur à l'appelant : une alerte ratée ne doit pas faire échouer l'action.
 */
export async function sendPushToRoles(
  schoolId: string,
  roles: string[],
  message: PushMessage,
  opts: { exceptStaffId?: string } = {}
): Promise<number> {
  if (!pushConfigured()) return 0;
  let webpush: { setVapidDetails: Function; sendNotification: Function };
  try {
    const mod: any = await import('web-push');
    webpush = mod.default && mod.default.sendNotification ? mod.default : mod;
  } catch {
    return 0;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@schoolflow.app',
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string
    );
  } catch {
    return 0;
  }
  const rows = await kvListPrefix(schoolId, PUSH_PREFIX);
  if (!rows || rows.length === 0) return 0;
  const payload = JSON.stringify({ ...message, at: Date.now() });
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    rows.map(async (row) => {
      let sub: PushSub;
      try {
        sub = JSON.parse(row.value);
      } catch {
        dead.push(row.key);
        return;
      }
      if (!sub?.endpoint || !sub?.keys?.p256dh || !roles.includes(sub.roleId)) return;
      if (opts.exceptStaffId && sub.staffId === opts.exceptStaffId) return;
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 60 * 60 * 6, urgency: 'high' });
        sent++;
      } catch (e: any) {
        // 404 / 410 : abonnement expiré ou retiré par l'utilisateur → on l'oublie.
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(row.key);
      }
    })
  );
  if (dead.length) {
    await supabase.from('school_kv').delete().eq('school_id', schoolId).in('key', dead);
  }
  return sent;
}

export async function savePushSubscription(schoolId: string, sub: PushSub): Promise<boolean> {
  const saved = await kvPut(schoolId, pushKeyFor(sub.staffId, sub.endpoint), JSON.stringify(sub), `${sub.roleId}|${sub.staffId}`);
  return !!saved;
}

export async function deletePushSubscription(schoolId: string, staffId: string, endpoint: string): Promise<void> {
  await supabase.from('school_kv').delete().eq('school_id', schoolId).eq('key', pushKeyFor(staffId, endpoint));
}
