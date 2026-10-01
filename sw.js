const CACHE="surgery-or-days-v2-20261001d";
const ASSETS=["./","./index.html","./or-style.css","./or-core.js","./or-ui.js","./or-followup.js?v=20260930m","./or-rules.js?v=20261001c","./or-fixes.js","./or-nativepdf.js?v=20260930m","./or-patient-actions.js?v=20261001a","./or-link-guidance.js?v=20261001c","./or-resident-share.js?v=20261001d","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(r=>{
    if(e.request.url.startsWith(self.location.origin)){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
});