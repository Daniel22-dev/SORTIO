const GHRAB_SW_CONTRACT='ghrab-service-worker-v1';
/* GHRAB service-worker contract v1 · update activation is user-controlled. */
const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = "ghrab-sortio-v1.1.19";
const CACHE_PREFIXES = ["ghrab-sortio-v", "sortio-v"];
const CORE = [
  "./",
  "./index.html",
  "./app.js",
  "./lazy/print-exports.js",
  "./lazy/seating-ui.js",
  "./lazy/seating-ui.css",
  "./lazy/media-library.js", "./lazy/production-tools.js",
  "./manifest.webmanifest",
  "./access/access-gate.css",
  "./access/reporter-bootstrap.js",
  "./access/error-reporter.js",
  "./access/error-reporter.css",
  "./access/error-reporter-adapter.js",
  "./assets/brand/school-logo.png",
  "./assets/sortio-mark.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./manual/",
  "./manual/index.html",
  "./config/brand-manifest.json",
];

self.addEventListener('message', (event) => {
  if (['GHRAB_SKIP_WAITING', 'SKIP_WAITING'].includes(event.data?.type)) self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    const optionalAssets = [];
    if (optionalAssets.length) {
      const results = await Promise.allSettled(optionalAssets.map((asset) => cache.add(asset)));
      const failed = results.filter((item) => item.status === 'rejected').length;
      if (failed) console.warn(`[GHRAB SW] ${failed} volitelných assetů nebylo uloženo do offline cache.`);
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl = '') {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (!response || !response.ok) throw new Error(`HTTP ${response?.status || 0}`);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl, { ignoreSearch: true });
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) await cache.put(request, response.clone());
  return response;
}

async function networkOnlyNoStore(request) {
  return fetch(request, { cache: 'no-store' });
}

function isSecurityCriticalRequest(url, scopePath) {
  const relative = url.pathname.slice(scopePath.length);
  return relative === 'access/deployment-config.js' ||
    relative === 'ghrab/ghrab-platform.js' ||
    relative === 'ghrab-platform.consumer.json' ||
    relative === 'config/deployment.json' ||
    relative === 'config/deployment.school-server.json' ||
    relative === 'config/deployment.school-server.example.json' ||
    relative === 'config/platform-manifest.json' ||
    relative === 'config/release-acceptance.json' ||
    relative === 'config/security-headers.json' ||
    relative === 'release-integrity.json' ||
    relative === 'release-integrity.sig' ||
    relative === 'integrity-status' ||
    relative === 'integrity-status.json' ||
    relative === 'runtime-config.js' ||
    /^(?:api|auth|session|health)(?:\/|$)/.test(relative);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL('./', self.location.href).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  if (isSecurityCriticalRequest(url, scopePath)) {
    event.respondWith(networkOnlyNoStore(request));
    return;
  }
  if (request.cache === 'no-store') return;
  if (request.mode === 'navigate') {
    const fallback = url.pathname.includes('/manual/') ? './manual/index.html' : './index.html';
    event.respondWith(networkFirst(request, fallback));
    return;
  }
  if (url.pathname.endsWith('/manifest.webmanifest') || url.pathname.endsWith('/build-info.json')) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
