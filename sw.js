/**
 * Blue Light Filter - Service Worker v3.0
 * Strategy: Cache-first for static assets, Network-first for manifest
 */

const VERSION     = 'blf-v3.0';
const STATIC      = 'blf-static-v3.0';
const DYNAMIC     = 'blf-dynamic-v3.0';

// Files that MUST be cached for offline use
const PRECACHE = [
  '/Nightlens/',
  '/Nightlens/index.html',
  '/Nightlens/manifest.json',
  '/Nightlens/icon-192.png',
  '/Nightlens/icon-512.png',
];

// ============================================================
// INSTALL — Pre-cache all critical files
// ============================================================
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${VERSION}`);
  event.waitUntil(
    caches.open(STATIC)
      .then(cache => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(PRECACHE);
      })
      .then(() => {
        console.log('[SW] Pre-cache complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => console.error('[SW] Pre-cache failed:', err))
  );
});

// ============================================================
// ACTIVATE — Clean up old caches
// ============================================================
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${VERSION}`);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC && k !== DYNAMIC)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// ============================================================
// FETCH — Smart caching strategy
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (analytics, etc)
  if (url.origin !== location.origin) return;

  // Manifest — Network first (always get latest)
  if (url.pathname.endsWith('manifest.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else — Cache first
  event.respondWith(cacheFirst(request));
});

// ============================================================
// CACHE STRATEGIES
// ============================================================

// Cache-first: Try cache → fall back to network → cache result
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response  = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback
    return caches.match('/Nightlens/index.html');
  }
}

// Network-first: Try network → fall back to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}

// ============================================================
// BACKGROUND SYNC — For schedule reliability
// ============================================================
self.addEventListener('sync', event => {
  if (event.tag === 'schedule-check') {
    event.waitUntil(checkSchedule());
  }
});

async function checkSchedule() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SCHEDULE_CHECK' });
  });
}

// ============================================================
// PUSH NOTIFICATIONS — For schedule alerts
// ============================================================
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/Nightlens/icon-192.png',
      badge: '/Nightlens/icon-192.png',
      tag: 'blf-notification',
      renotify: false,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('/Nightlens/');
    })
  );
});

console.log(`[SW] ${VERSION} loaded`);
                      
