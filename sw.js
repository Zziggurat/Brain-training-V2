/*
 * Service worker with Smart Caching Strategy
 * - HTML (Navigation): Network-First (ensures latest version, falls back to cache/offline)
 * - Assets (JS, CSS, Images): Stale-While-Revalidate (fast load, updates in background)
 * - Google Fonts: Cache-First in a dedicated cache (works offline after first load)
 *
 * Note: assets are requested with a `?r=<version>` cache-busting query, so all
 * cache lookups use { ignoreSearch: true }. Without it, the precached clean
 * URLs never matched the versioned requests and the app did not work offline.
 */

const CACHE_NAME = 'brain-training-v2107';
const FONT_CACHE_NAME = 'brain-training-fonts-v1';

// Relative paths: the app must also work when hosted in a sub-directory
// (e.g. GitHub Pages), where an absolute '/' would fail to precache.
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  // Core application logic
  'script.js',
  'lib/problemWeight.js',
  'lib/adaptiveEngine.js',
  'lib/levels.js',
  // Styles
  'style.css',
  'custom.css',
  // Images
  'icon-192.png',
  'icon-512.png',
  'assets/ciudad-cyberpunk.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
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
          .filter((cacheName) => cacheName !== CACHE_NAME && cacheName !== FONT_CACHE_NAME)
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

  // Google Fonts: cache-first so the typeface works offline after first visit
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FONT_CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && (response.status === 200 || response.type === 'opaque')) {
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
    return;
  }

  // Ignore other cross-origin requests (extensions, analytics, etc.)
  if (url.origin !== self.location.origin) return;

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
          const cachedResponse = await cache.match(request, { ignoreSearch: true });
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
      const cachedResponse = await cache.match(request, { ignoreSearch: true });

      // Network request to update cache
      const networkPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failure is fine if we have cache
          return undefined;
        });

      // Return cached response right away if we have it, else wait for network
      if (cachedResponse) return cachedResponse;
      const networkResponse = await networkPromise;
      if (networkResponse) return networkResponse;
      throw new Error('Resource unavailable offline');
    })()
  );
});
