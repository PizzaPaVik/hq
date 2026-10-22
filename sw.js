// HQ service worker – gör appen snabb och användbar offline.
// Byt VERSION när du laddar upp ändrade filer.
const VERSION = 'hq-1.5.0';
const ASSETS = ['./', './index.html', './stad.html', './styles.css', './app.js', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Supabase-anrop går alltid direkt
  // Navigering till stad.html ska visa staden, allt annat visar appen.
  const key = req.mode === 'navigate' ? (/\/stad\.html$/.test(url.pathname) ? './stad.html' : './index.html') : req;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || new Response('Offline', { status: 503 });
  }));
});
