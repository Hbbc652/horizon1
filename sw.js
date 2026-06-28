// Horizon 1 PWA Service Worker
// Cache-first for app shell, network-first for Firebase/CDN scripts
const CACHE = 'horizon1-v1';
const SHELL = [
  '/',
  '/index.html',
];

// Install — cache the app shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(SHELL);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate — delete old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — cache-first for app shell, network-only for Firebase/CDN
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Always go to network for Firebase, CDN scripts, and external APIs
  if(url.includes('firebase') ||
     url.includes('firebaseio.com') ||
     url.includes('cdnjs.cloudflare.com') ||
     url.includes('googleapis.com') ||
     url.includes('gstatic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // App shell — cache first, update in background (stale-while-revalidate)
  if(e.request.method === 'GET' &&
     (url.endsWith('/') || url.endsWith('/index.html') || url.endsWith('horizon-hs-ops.com/'))) {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(response) {
            if(response && response.status === 200) {
              cache.put(e.request, response.clone());
            }
            return response;
          }).catch(function() { return cached; });
          // Return cached immediately, update in background
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Everything else — network first, fall back to cache
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});
