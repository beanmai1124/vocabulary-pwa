const CACHE="excel-vocab-v24";
const APP_SHELL=[
  "./",
  "./index.html?v=24",
  "./style.css?v=24",
  "./app.js?v=24",
  "./fflate.min.js?v=24",
  "./manifest.webmanifest?v=24"
];
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
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html?v=24")))
  );
});
