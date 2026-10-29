// Offline play, latest version when online: network first, cache as fallback.
// Requests skip the browser's HTTP cache (GitHub Pages sends max-age=600) and revalidate
// with the server, so a deploy shows up on the next launch. Offline, or after 3 s, the
// cached copy is used.
const CACHE = 'splice-6';   // a new name drops the old cache, see activate; only splice- caches, the origin is shared with Kiln
const SHELL = ['./', 'index.html', 'style.css', 'fonts/chakra-petch-latin-400.woff2', 'fonts/chakra-petch-latin-600.woff2', 'src/core.js', 'src/levels.js', 'src/bot.js', 'src/hosts.js', 'src/hostdraw.js', 'src/run.js', 'src/items.js', 'src/icons.js', 'src/plays.js', 'src/build.js', 'src/ui.js', 'manifest.webmanifest',
  'lang/languages.json', 'lang/en.json',   // other languages get cached the first time they load
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'no-cache' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('splice-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname;   // one cache entry per file, whatever the query string
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const opts = { cache: 'no-cache' };
      if (AbortSignal.timeout) opts.signal = AbortSignal.timeout(3000);
      const r = await fetch(e.request.url, opts);   // by URL: navigation requests cannot take options
      if (r.ok) c.put(key, r.clone());
      return r;
    } catch {
      return (await c.match(key)) || Response.error();
    }
  })());
});
