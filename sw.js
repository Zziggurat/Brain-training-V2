/*
 * Service worker with Smart Caching Strategy
 * - HTML (Navigation): Network-First (ensures latest version, falls back to cache/offline)
 * - Assets (JS, CSS, Images): Stale-While-Revalidate (fast load, updates in background)
 */

const CACHE_NAME = 'brain-training-v1515'; // Incremented version
const PRECACHE_ASSETS = [
  '/',
  'index.html',
  'manifest.json',
  // Core application logic
  'script.js',
  'lib/problemWeight.js',
  // Styles
  'style.css',
  'custom.css',
  // Images
  'assets/ciudad-cyberpunk.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Clean query params from cache keys to avoid duplication/mismatch
      // We precache pure URLs; the specific versions will be handled by SWR strategy later
      await cache.addAll(PRECACHE_ASSETS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Ignore requests from chrome extensions or other origins
  if (!url.origin.startsWith(self.location.origin)) return;

  // STRATEGY 1: Network-First for HTML (Navigation)
  // Ensures user always gets the latest index.html with new asset references
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          // Attempt network fetch
          const networkResponse = await fetch(request);

          // If successful, update cache and return
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }

          // If network returns 404 or other error, try cache (or fallback)
          throw new Error('Network response was not ok');
        } catch (error) {
          // Network failed (offline), try cache
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(request);
          if (cachedResponse) return cachedResponse;

          // Fallback to index.html if specific page not found in cache
          const fallback = await cache.match('index.html');
          if (fallback) return fallback;

          throw error;
        }
      })()
    );
    return;
  }

  // STRATEGY 2: Stale-While-Revalidate for Static Assets
  // Returns cache immediately if available, but updates it from network in background
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      // Network request to update cache
      const networkPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch((err) => {
          // Network failure is fine if we have cache
          console.log('Background update failed', err);
        });

      // Return cached response right away if we have it, else wait for network
      return cachedResponse || networkPromise;
    })()
  );
});
