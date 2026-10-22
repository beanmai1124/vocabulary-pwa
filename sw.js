const CACHE="excel-vocab-cache-20261022c";
const APP_SHELL=["./","./index.html","./style.css","./app.js","./fflate.min.js","./manifest.webmanifest"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.pathname.endsWith("/vocabulary.xlsx")){
    event.respondWith(fetch(event.request,{cache:"no-store"}));
    return;
  }
  event.respondWith(fetch(event.request,{cache:"no-cache"}).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html"))));
});
