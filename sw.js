// sw.js
// VERSION V15 - CACHE SHELL ET IMAGES SÉPARÉS, RAPIDITÉ ACCRUE
const CACHE_NAME = 'cinematch-v15-offline-capable';
const IMAGE_CACHE_NAME = 'cinematch-images-v15';
const MAX_IMAGES = 200;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './search.html',
  './watchlist.html',
  './profile.html',
  './film.html',
  './serie.html',
  './person.html',
  './platforms.html',
  './app.js',
  './config.js',
  './data.js',
  './details.js',
  './person.js',
  './watchlist.js',
  './firebase-config.js',
  './js/utils.js',
  './js/popular.js',
  './js/search.js',
  './js/platforms.js',
  './js/awards.js',
  './js/offlineManager.js',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
  'https://fonts.googleapis.com/css2?family=Spline+Sans:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400..700,0..1,0'
];

function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => {
          trimCache(cacheName, maxItems);
        });
      }
    });
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 1. STRATÉGIE "CACHE FIRST" POUR LES IMAGES (dans un cache dédié aux images)
  if (event.request.destination === 'image' || url.href.includes('image.tmdb.org')) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((imageCache) => {
        return imageCache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              imageCache.put(event.request, networkResponse.clone());
              trimCache(IMAGE_CACHE_NAME, MAX_IMAGES);
            }
            return networkResponse;
          }).catch(() => caches.match(event.request));
        });
      })
    );
    return;
  }

  // 2. STRATÉGIE "RÉSEAU D'ABORD" AVEC FALLBACK CACHE POUR LE RESTE (HTML, JS, API)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
