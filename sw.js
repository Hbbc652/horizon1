// Horizon 1 PWA Service Worker v3
const CACHE = 'horizon1-v3';

// Cache app shell + CDN scripts on install
const PRECACHE = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-app-compat.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-database-compat.min.js',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Firebase data — always network only (never cache live data)
  if(url.includes('firebaseio.com') || url.includes('googleapis.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // CDN scripts + app shell — cache first, update in background
  if(e.request.method === 'GET') {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(response) {
            if(response && response.status === 200) {
              cache.put(e.request, response.clone());
            }
            return response;
          }).catch(function(){ return cached; });
          return cached || networkFetch;
        });
      })
    );
  }
});
