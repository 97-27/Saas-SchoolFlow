'use client';

/**
 * Envoie un rapport d'erreur au serveur (/api/client-error). Jamais bloquant, jamais en boucle :
 * au plus 10 rapports par page ouverte, et un même message n'est envoyé qu'une fois.
 */
let sent = 0;
const seen = new Set<string>();

export function reportClientError(error: unknown, context = ''): void {
  if (typeof window === 'undefined' || sent >= 10) return;
  try {
    const err = error as any;
    const message = `${context ? `${context} : ` : ''}${err?.message || String(error)}`.slice(0, 500);
    if (seen.has(message)) return;
    seen.add(message);
    sent++;
    const body = JSON.stringify({
      message,
      stack: String(err?.stack || '').slice(0, 1500),
      page: window.location.pathname,
      version: (window as any).__SF_VERSION__ || '',
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch (e) {}
}

let installed = false;

/** Capte les erreurs non gérées de tout l'écran (une seule fois). */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    // Erreurs de chargement d'image ou de script externe : pas d'objet erreur, sans intérêt.
    if (!e.error) return;
    reportClientError(e.error, 'Erreur');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason: any = e.reason;
    // Coupure réseau passagère : normale sur téléphone, déjà gérée par les nouvelles tentatives.
    if (reason && /Failed to fetch|NetworkError|Load failed|aborted/i.test(String(reason?.message || reason))) return;
    reportClientError(reason, 'Promesse');
  });
}
