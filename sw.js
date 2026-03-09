const CACHE = 'gita-wisdom-v4';
const CORE = ['./', './index.html', './manifest.json', './data/gita.json', './icons/icon-192x192.svg', './icons/icon-512x512.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(err => console.warn('Cache install partial:', err))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Fonts: network first, cache fallback
  if(url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(cached=>{
      return fetch(e.request).then(r=>{c.put(e.request,r.clone());return r;}).catch(()=>cached);
    })));
    return;
  }
  // Everything else: cache first
  e.respondWith(caches.match(e.request).then(cached=>{
    if(cached) return cached;
    return fetch(e.request).then(r=>{
      if(r&&r.status===200&&r.type!=='opaque'){caches.open(CACHE).then(c=>c.put(e.request,r.clone()));}
      return r;
    });
  }));
});
