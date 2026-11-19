const CACHE = "ams-check-v2";
const SHELL = [
  "./",
  "./index.html",
  "./assets/style.css",
  "./src/ams.js",
  "./src/app.js",
  "./src/routes.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ),
  );
  self.clients.claim();
});

// 有缓存就先给缓存，同时后台回源更新；没缓存再等网络。
async function respond(request) {
  const hit = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(respond(event.request));
});
