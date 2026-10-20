const CACHE = "vocab-pf-v6";
const STATIC_FILES = [
  "./",
  "./index.html",
  "./style.css?v=6",
  "./app.js?v=6",
  "./manifest.webmanifest?v=6",
  "./vocabulary_template.csv?v=6",
  "./icons/icon-192.png?v=6",
  "./icons/icon-512.png?v=6"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isProgramFile = /(?:index\.html|app\.js|style\.css|manifest\.webmanifest|vocabulary_template\.csv)$/.test(url.pathname);

  if (isProgramFile) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
