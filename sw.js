// sw.js
// VERSION V13 - ACTIVATION DU MODE HORS LIGNE, CACHE DYNAMIQUE ET NETTOYAGE AUTO
const CACHE_NAME = 'cinematch-v13-offline-capable';
const MAX_IMAGES = 150; // Nombre maximum d'images à conserver en mémoire

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
  './js/offlineManager.js',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
  'https://fonts.googleapis.com/css2?family=Spline+Sans:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400..700,0..1,0'
];

// Fonction magique pour limiter la taille du cache et préserver le stockage de l'iPhone
function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        // Supprime la plus vieille image pour faire de la place
        cache.delete(keys[0]).then(() => {
          trimCache(cacheName, maxItems); 
        });
      }
    });
  });
}

// Installation : Force l'arrêt de l'ancien Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activation : Supprime immédiatement tous les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression du vieux cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. STRATÉGIE "CACHE FIRST" POUR LES IMAGES (Rendu instantané)
  // Cible toutes les images, y compris les affiches provenant de l'API TMDB
  if (event.request.destination === 'image' || url.href.includes('image.tmdb.org')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Si on l'a en stock, on l'affiche tout de suite
        if (cachedResponse) {
          return cachedResponse;
        }
        // Sinon on la télécharge et on la sauvegarde
        return fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            
            // On lance le nettoyage automatique en arrière-plan
            trimCache(CACHE_NAME, MAX_IMAGES); 
            
            return networkResponse;
          });
        });
      })
    );
    return; // On arrête l'exécution ici pour les requêtes d'images
  }

  // 2. STRATÉGIE "RÉSEAU D'ABORD" POUR LE RESTE (HTML, JS, API)
  // Permet d'avoir une application toujours à jour si une connexion est disponible
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
