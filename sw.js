// Horizon 1 PWA Service Worker v6
const CACHE = 'horizon1-v6';

// Cache app shell + CDN scripts on install
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-16.png',
  '/icon-32.png',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
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

  if(e.request.method !== 'GET') return;

  // The app shell itself (index.html / navigations) — NETWORK FIRST. This is the
  // one file that changes on every deploy; cache-first here is what caused fixed
  // bugs to silently keep showing the old broken version on already-installed
  // phones no matter how many times the file was corrected on the server. Falls
  // back to cache only if offline, so it still opens instantly with no signal.
  var isAppShell = e.request.mode === 'navigate' || url.endsWith('/index.html') || url.endsWith('/');
  if(isAppShell) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        if(response && response.status === 200) {
          caches.open(CACHE).then(function(cache){ cache.put(e.request, response.clone()); });
        }
        return response;
      }).catch(function() {
        return caches.open(CACHE).then(function(cache){ return cache.match(e.request); });
      })
    );
    return;
  }

  // CDN scripts, icons, manifest — cache first, update in background. These are
  // pinned to specific versioned URLs, so they don't change without the URL
  // itself changing, making cache-first safe and fast for them.
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
});
