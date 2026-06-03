// Product Imagination Agents OS — Service Worker
// Caches all app assets for offline use on iOS

const CACHE = 'pi-agents-os-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './hero.jpg',
  './icon-512.png',
  './icon-192.png',
  './icon-180.png',
  './icon-167.png',
  './icon-152.png',
  './icon-120.png',
  './icon-76.png',
  './favicon.png',
  './splash-1290x2796.png',
  './splash-1179x2556.png',
  './splash-1170x2532.png',
  './splash-1125x2436.png',
  './splash-828x1792.png',
  './splash-750x1334.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap',
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for assets, network-first for API
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
