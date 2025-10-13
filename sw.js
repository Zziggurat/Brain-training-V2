// Service worker para la aplicación de tablas de multiplicar.
// Proporciona caché básica para funcionalidad offline.

// Actualizamos el nombre del caché para forzar a los clientes a actualizar
// cuando se despliegan cambios importantes en el código. Cambiar este
// valor invalidará el caché anterior y hará que se descarguen los nuevos
// archivos al instalar el service worker. Al usar un nombre único como
// 'brain-training-v4' garantizamos que el servicio esté actualizado.
const CACHE_NAME = 'brain-training-v4';
// Archivos que se deben almacenar en caché para usar sin conexión.
const CACHE_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Evento de instalación: se abre el caché y se agregan los archivos.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_FILES);
    })
  );
  // Activa inmediatamente el SW sin esperar a las pestañas cerrarse.
  self.skipWaiting();
});

// Evento de activación: limpia versiones antiguas del caché.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      // Reclama control de las páginas abiertas una vez limpio el caché previo
      await self.clients.claim();
    })()
  );
});

// Intercepta peticiones de red: intenta servir desde caché, si no, desde la red.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si encontramos en caché, devolvemos esa respuesta.
      if (cachedResponse) {
        return cachedResponse;
      }
      // En caso contrario, intentamos obtenerla de la red.
      return fetch(event.request).catch(() => {
        // Si hay un error (sin conexión), podríamos devolver un fallback.
        // Aquí simplemente rechazamos la promesa.
        return Promise.reject('offline');
      });
    })
  );
});