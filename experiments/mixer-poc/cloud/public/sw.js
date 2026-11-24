// Kill switch for last year's service worker (vite-plugin-pwa registered /sw.js, scope /, cache 'songs-cache').
// Browsers re-check a registered sw.js on navigation, so last year's phones get this on their first visit: it
// empties every cache, unregisters itself and reloads the open pages. This year's player registers no /sw.js
// (a future one would be player-sw.js with caches prefixed quina-player-), so nothing collides.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) await caches.delete(k);
      await self.registration.unregister();
      for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
    })(),
  ),
);
