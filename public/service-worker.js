
// FORCE REFRESH SERVICE WORKER - v8.0 (Relative Paths Fix)
// This service worker intentionally bypasses the cache to ensure you see the latest changes.

const CACHE_NAME = 'invert-fm-v8-rel-paths';

self.addEventListener('install', (event) => {
  // Force this new service worker to become active immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
  
  // Delete ALL previous caches to ensure no old files remain
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // NETWORK ONLY STRATEGY
  // Do not look in the cache. Always go to the server.
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.error('Network request failed:', error);
      return new Response('Offline - Connect to internet to update app.');
    })
  );
});
