const CACHE_VERSION = "v4";
const STATIC_CACHE = `lendz-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lendz-pages-${CACHE_VERSION}`;
const DATA_CACHE = `lendz-data-${CACHE_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, DATA_CACHE];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (!url.protocol.startsWith("http")) return;

  // Cache-first: Next.js static chunks and public assets
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/favicon.ico" ||
    /\.(svg|png|ico|webp|jpg|jpeg|woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Network-first: Supabase REST API (cross-origin data)
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Network-first: same-origin pages and RSC payloads
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await safePut(cache, request, response.clone());
    return response;
  } catch {
    return new Response("Not available offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) await safePut(cache, request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // For page navigations, try to serve the root shell as fallback
    if (request.mode === "navigate") {
      const root = await caches.match("/");
      if (root) return root;
    }

    return new Response(
      JSON.stringify({
        offline: true,
        message: "No cached response available",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREFETCH_URLS") return;
  const urls = event.data.urls;
  if (!Array.isArray(urls)) return;
  event.waitUntil(prefetchUrls(urls));
});

async function prefetchUrls(urls) {
  const cache = await caches.open(PAGES_CACHE);
  for (const url of urls) {
    try {
      const cached = await cache.match(url);
      if (cached) continue;
      const response = await fetch(url, { credentials: "same-origin" });
      if (response.ok) await safePut(cache, new Request(url), response.clone());
      await new Promise((r) => setTimeout(r, 80));
    } catch {
      // Skip failed URL silently
    }
  }
}

self.addEventListener("push", (event) => {
  let data = { title: "Utangz", body: "Good morning ma! 🌅" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    /* use defaults */
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Utangz", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "morning-greeting",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        if (clients.length > 0) return clients[0].focus();
        return self.clients.openWindow("/dashboard");
      }),
  );
});

async function safePut(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch {
    // Strip Cache-Control headers that prevent storage and retry
    try {
      const headers = new Headers(response.headers);
      headers.delete("Cache-Control");
      headers.delete("Pragma");
      const clean = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      await cache.put(request, clean);
    } catch {
      // Give up silently
    }
  }
}
