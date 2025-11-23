const CACHE_NAME = 'cinematch-v1';
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

// Installation : On met en cache les fichiers statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Mise en cache des fichiers app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activation : On nettoie les vieux caches
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
    })
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  // Pour l'API TMDB, on ne cache pas (ou on pourrait faire une stratégie plus complexe)
  if (event.request.url.includes('api.themoviedb.org')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si c'est dans le cache, on le rend
        if (response) {
          return response;
        }
        // Sinon on va chercher sur le réseau
        return fetch(event.request);
      })
  );
});
