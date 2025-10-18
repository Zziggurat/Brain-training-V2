/*
 * Service worker placeholder that immediately unregisters itself.
 * Keeps legacy installations from holding onto cached assets while
 * allowing new loads to proceed without a service worker.
 */

const CACHE_VERSION = 'brain-training-v5';

self.addEventListener('install', (event) => {
  // Take control as soon as we're installed so we can unregister.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any caches the previous worker created.
      const cacheNames = await caches.keys();
      const cachesToDelete = cacheNames.filter((cacheName) => cacheName !== CACHE_VERSION);
      await Promise.all(cachesToDelete.map((cacheName) => caches.delete(cacheName)));

      // Take control immediately so the cleaned clients render the fresh background.
      await self.clients.claim();

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
