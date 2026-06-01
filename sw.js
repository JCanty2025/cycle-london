/* ═══════════════════════════════════════════════════════════════════
   Cycle London with Jonah — Service Worker
   Handles caching for offline operation
   ═══════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'clj-v1';
const AUDIO_CACHE = 'clj-audio-v1';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap'
];

// Audio files — cached on first play (network-first, then cache)
const AUDIO_FILES = [
  './audio/intro.mp3',
  './audio/stop01.mp3', './audio/stop02.mp3', './audio/stop03.mp3',
  './audio/stop04.mp3', './audio/stop05.mp3', './audio/stop06.mp3',
  './audio/stop07.mp3', './audio/stop08.mp3', './audio/stop09.mp3',
  './audio/stop10.mp3'
];

// ─── Install: pre-cache core assets ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== AUDIO_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: smart caching strategy ───────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Audio files: network-first, fallback to cache
  if (url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3')) {
    event.respondWith(networkFirstAudio(event.request));
    return;
  }

  // Map tiles: network-first (always want fresh maps)
  if (url.hostname.includes('openstreetmap') || url.hostname.includes('cartocdn')) {
    event.respondWith(networkFirstWithCache(event.request, CACHE_NAME));
    return;
  }

  // Google Fonts: cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // CDN assets (Leaflet): cache-first
  if (url.hostname.includes('unpkg.com') || url.hostname.includes('cdnjs')) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // Core app files: cache-first with network fallback
  event.respondWith(cacheFirst(event.request, CACHE_NAME));
});

// ─── Cache strategies ─────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirstAudio(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(AUDIO_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return empty 404 so JS knows to fall back to speech synthesis
    return new Response('', { status: 404 });
  }
}
