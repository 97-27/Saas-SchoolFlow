'use client';

/**
 * Côté appareil : enregistrement du service worker (public/sw.js) et abonnement aux
 * notifications en arrière-plan (/api/push). Voir lib/server/push.ts.
 */
const SUBSCRIBED_KEY = 'schoolflow_push_subscribed_v1';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Abonne CET appareil (après que la personne a accepté les notifications). Renvoie true si
 * l'abonnement est enregistré côté serveur. Silencieux en cas d'échec.
 */
export async function subscribeToPush(label = ''): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const cfg = await fetch('/api/push', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
    if (!cfg?.enabled || !cfg.publicKey) return false;
    const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
    if (!reg) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToBytes(cfg.publicKey) as BufferSource,
      });
    }
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), label: label || navigator.userAgent.slice(0, 80) }),
    });
    const ok = res.ok;
    try {
      localStorage.setItem(SUBSCRIBED_KEY, ok ? String(Date.now()) : '');
    } catch {}
    return ok;
  } catch {
    return false;
  }
}

/** Réabonne discrètement (une fois par jour) : l'abonnement serveur suit le compte connecté. */
export async function ensurePushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  let last = 0;
  try {
    last = Number(localStorage.getItem(SUBSCRIBED_KEY) || 0);
  } catch {}
  if (Date.now() - last < 24 * 60 * 60 * 1000) return;
  await subscribeToPush();
}
