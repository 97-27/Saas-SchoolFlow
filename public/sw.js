/* SchoolFlow — service worker : notifications en arrière-plan + page hors connexion.
   Aucune page de gestion n'est mise en cache (données d'élèves) : seule la page « hors
   connexion » et les icônes le sont. */
// Version du cache : changer ce numéro supprime les anciens caches sur tous les téléphones.
const CACHE = 'school-flow-africa-shell-v2';
const OFFLINE_URL = '/offline.html';
// Le manifeste (nom de l'application) n'est JAMAIS mis en cache : sinon le téléphone garde
// l'ancien nom « School Flow » après une mise à jour.
const PRECACHE = [OFFLINE_URL, '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Navigation sans réseau → page hors connexion (jamais une copie d'une page de gestion).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  const url = new URL(req.url);
  if (req.method === 'GET' && url.origin === self.location.origin && PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'SchoolFlow', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'SchoolFlow';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    vibrate: [120, 60, 120],
    data: { url: data.url || '/', sound: data.sound || 'default' },
  };
  event.waitUntil(
    self.registration.showNotification(title, options).then(() =>
      // Onglet ouvert : il joue la sonnerie et affiche l'alerte dans la page.
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'sf-push', payload: data }));
      })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.focus();
          if ('navigate' in c && url !== '/') c.navigate(url).catch(() => {});
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
