// sw.js
const CACHE_NAME = 'cinematch-v6'; // CHANGEMENT VERS V6
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
  './js/search.js',
  './js/platforms.js',
  './js/awards.js',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
  'https://fonts.googleapis.com/css2?family=Spline+Sans:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400..700,0..1,0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // FORCE L'INSTALLATION
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // PREND LE CONTRÔLE IMMEDIATEMENT
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('api.themoviedb.org')) {
    return; 
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
