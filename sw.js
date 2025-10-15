/*
 * Service worker placeholder that immediately unregisters itself.
 * Keeps legacy installations from holding onto cached assets while
 * allowing new loads to proceed without a service worker.
 */

self.addEventListener('install', (event) => {
  // Take control as soon as we're installed so we can unregister.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any caches the previous worker created.
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

      // Unregister this worker so the app runs without a SW going forward.
      await self.registration.unregister();

      // Refresh open clients so they pick up the non-SW controlled version.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        client.navigate(client.url);
      });
    })()
  );
});

self.addEventListener('fetch', () => {
  // No-op fetch handler keeps the worker from attempting to respond with stale cache.
});
