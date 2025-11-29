const CACHE_NAME = 'mooseek-v1';
// This list will be updated by the build process in a real-world scenario.
// For now, we'll cache the essentials.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  // Since Vite uses hashed assets, we can't hardcode them.
  // The service worker will cache assets as they are requested.
];

// Install event: opens a cache and adds the core files to it.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Activate event: clean up old caches.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: serves assets from cache or network.
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  const isExternal = !event.request.url.startsWith(self.origin);

  // For external resources (APIs, audio files), use a network-first strategy.
  // This avoids issues with stale data, redirects, or CORS on cached responses.
  if (isExternal) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Optional: return a fallback from cache if network fails,
        // but for APIs, failing is often better than serving stale data.
        return caches.match(event.request);
      })
    );
    return;
  }

  // For local app assets, use a cache-first strategy for performance.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
