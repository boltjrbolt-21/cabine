/* Cabine — service worker.
   Deux caches séparés :
   - SHELL, revalidé à chaque version, contient l'app elle-même ;
   - VENDOR, immuable, garde les ~10 Mo de modèles MediaPipe et le WASM.
     Leurs URLs portent leur numéro de version, donc un fichier mis en cache
     ne peut jamais devenir périmé : on le sert sans jamais retourner au réseau.
     C'est ce cache qui fait la différence entre un démarrage instantané et
     un rechargement complet du modèle à chaque visite. */

const VERSION = 'v23';
const SHELL   = 'cabine-shell-' + VERSION;
const VENDOR  = 'cabine-vendor-v1';

const SHELL_FILES = [
  './',
  'index.html',
  'avatar.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

// hôtes dont les URLs sont versionnées, donc cachables indéfiniment
const VENDOR_HOSTS = [
  'storage.googleapis.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll échoue en bloc dès qu'un fichier manque : on tolère les absents
      .then(c => Promise.allSettled(SHELL_FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== VENDOR).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // on ne garde que les réponses complètes : une 206 ou une erreur casserait le cache
  if (res && res.status === 200) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req) || await cache.match('index.html');
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // modèles, WASM et polices : immuables, jamais revalidés
  if (VENDOR_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req, VENDOR));
    return;
  }

  if (url.origin !== location.origin) return;

  // la page elle-même passe par le réseau pour que les mises à jour arrivent
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(networkFirst(req, SHELL));
    return;
  }

  e.respondWith(cacheFirst(req, SHELL));
});
