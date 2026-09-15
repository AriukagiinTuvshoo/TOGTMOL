/* Only public application assets are cached. Auth, Supabase and token-bearing
   URLs always use the network. A new worker waits for existing tabs to close. */
const CACHE = "togtmol-shell-__BUILD_ID__";
const ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch("/precache-manifest.json", {
        cache: "no-store",
      });
      if (!response.ok) throw Error("Offline manifest unavailable");
      const manifest = await response.json();
      const cache = await caches.open(CACHE);
      await cache.addAll([...ASSETS, ...manifest.assets]);
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("togtmol-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (
    request.headers.has("authorization") ||
    url.searchParams.has("code") ||
    url.searchParams.has("access_token") ||
    url.searchParams.has("error") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/api")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname === "/" && !url.search) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE).then((cache) => cache.put("/", copy)),
            );
          }
          return response;
        })
        .catch(() =>
          caches.match("/").then((cached) => cached || Response.error()),
        ),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  )
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches.open(CACHE).then((cache) => cache.put(request, copy)),
              );
            }
            return response;
          }),
      ),
    );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const client = clients.find(
        (c) => new URL(c.url).origin === self.location.origin,
      );
      return client ? client.focus() : self.clients.openWindow("/");
    }),
  );
});
