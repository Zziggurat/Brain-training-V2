/*
 * Service worker that refreshes cached assets each release while
 * keeping the cyberpunk background and stylesheet network-first so
 * they never get stuck behind stale caches.
 */

const CACHE_NAME = 'brain-training-v11';
const PRECACHE_ASSETS = [
  '/',
  'index.html',
  'manifest.json',
  'script.js?r=20241102-1512'
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
        cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  const hasBustParam = url.searchParams.has('r');
  const isWallpaper = url.pathname.endsWith('/assets/ciudad-cyberpunk.png');
  const isStylesheet = url.pathname.endsWith('/style.css');
  const isBypassedAsset = hasBustParam && (isWallpaper || isStylesheet);

  if (isBypassedAsset) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request, { cache: 'no-store' });
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(request);
          if (fallback) {
            return fallback;
          }
          throw error;
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);

        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        if (request.mode === 'navigate') {
          const fallback = await cache.match('index.html');
          if (fallback) {
            return fallback;
          }
        }
        throw error;
      }
    })()
  );
});