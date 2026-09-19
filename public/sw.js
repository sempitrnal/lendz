const CACHE_VERSION = "v5";
const STATIC_CACHE = `lendz-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lendz-pages-${CACHE_VERSION}`;
const DATA_CACHE = `lendz-data-${CACHE_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, DATA_CACHE];

const OFFLINE_URL = "/offline";

const OUTBOX_DB = "lendz-outbox";
const OUTBOX_STORE = "requests";

// Prefetch queue persists in IndexedDB so an interrupted pass (service worker
// killed mid-run, tab closed, went offline) resumes where it left off instead
// of silently dropping the tail of the route list.
const PREFETCH_DB = "lendz-prefetch";
const PREFETCH_QUEUE = "queue";
const PREFETCH_META = "meta";
const PREFETCH_CONCURRENCY = 4;

let prefetchDraining = false;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
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
      .then(() =>
        self.registration.navigationPreload
          ? self.registration.navigationPreload.enable()
          : undefined,
      )
      .then(() => self.clients.claim())
      .then(() => drainPrefetchQueue()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  const url = new URL(request.url);

  if (!url.protocol.startsWith("http")) return;

  // Non-GET: queue mutations that fail while offline instead of dropping them
  if (request.method !== "GET") {
    if (isQueueableMutation(request, url)) {
      event.respondWith(fetchOrQueue(request));
    }
    return;
  }

  // Cache-first: Next.js static chunks and public assets
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/favicon.ico" ||
    /\.(svg|png|ico|webp|jpg|jpeg|woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Network-first: Supabase REST/storage (cross-origin data).
  // Auth and realtime traffic must always hit the network.
  if (url.hostname.includes("supabase.co")) {
    if (
      url.pathname.startsWith("/rest/v1/") ||
      url.pathname.startsWith("/storage/v1/")
    ) {
      event.respondWith(networkFirst(request, DATA_CACHE));
    }
    return;
  }

  // Network-first: same-origin pages and RSC payloads
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request, event));
    return;
  }
});

// --- Caching strategies ---

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

// Page/RSC requests are cached under normalized keys: the volatile `_rsc`
// cache-busting param is stripped, and RSC payloads get their own key so a
// flight response never overwrites the HTML entry for the same URL.
function pageCacheKey(request) {
  const url = new URL(request.url);
  const isRsc = url.searchParams.has("_rsc") || request.headers.has("rsc");
  url.searchParams.delete("_rsc");
  if (isRsc) url.searchParams.set("__sw_rsc", "1");
  return new Request(url.toString());
}

async function networkFirstPage(request, event) {
  const cache = await caches.open(PAGES_CACHE);
  const key = pageCacheKey(request);

  try {
    let response = null;
    if (event?.preloadResponse) {
      response = await event.preloadResponse.catch(() => null);
    }
    if (!response) response = await fetch(request);
    // Never store redirected responses (e.g. /login) under the requested URL
    if (response.ok && !response.redirected) {
      await safePut(cache, key, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
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

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      await safePut(cache, request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
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

// --- Offline mutation outbox ---

function isQueueableMutation(request, url) {
  const method = request.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;

  // Same-origin: server actions and /api/* routes
  if (url.origin === self.location.origin) return true;

  // Supabase REST writes only — never auth or realtime traffic
  if (url.hostname.includes("supabase.co")) {
    return url.pathname.startsWith("/rest/v1/");
  }

  return false;
}

async function fetchOrQueue(request) {
  const clone = request.clone();
  try {
    return await fetch(request);
  } catch {
    try {
      await enqueueOutbox(clone);
      notifyClients({ type: "OUTBOX_QUEUED" });
    } catch {
      // IndexedDB unavailable — fall through to plain failure
    }
    return new Response(JSON.stringify({ offline_queued: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function openOutboxDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(OUTBOX_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueOutbox(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = await request.arrayBuffer();
  const entry = {
    url: request.url,
    method: request.method,
    headers,
    body,
    queuedAt: Date.now(),
  };
  const db = await openOutboxDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).put(entry);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function replayOutbox() {
  const db = await openOutboxDb();
  let entries;
  try {
    entries = await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const store = tx.objectStore(OUTBOX_STORE);
      const items = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          items.push({ key: cursor.primaryKey, ...cursor.value });
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(items);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    db.close();
    return;
  }

  let synced = 0;
  let failed = 0;
  for (const entry of entries) {
    try {
      const response = await fetch(
        new Request(entry.url, {
          method: entry.method,
          headers: entry.headers,
          body: entry.body,
          credentials: "include",
        }),
      );
      if (response.status >= 500) {
        break; // Server down — retry later, preserve remaining order
      }
      await deleteOutboxEntry(db, entry.key);
      if (response.ok) synced += 1;
      else failed += 1; // 4xx = permanently rejected, drop it
    } catch {
      break; // Still offline — keep the rest queued
    }
  }
  db.close();

  if (synced > 0 || failed > 0) {
    notifyClients({ type: "OUTBOX_RESULT", synced, failed });
  }
}

function deleteOutboxEntry(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    tx.objectStore(OUTBOX_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function notifyClients(message) {
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => clients.forEach((c) => c.postMessage(message)))
    .catch(() => {});
}

// --- Messages from the page ---

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "PREFETCH_URLS") {
    const urls = event.data.urls;
    if (!Array.isArray(urls)) return;
    event.waitUntil(
      seedPrefetchQueue(urls, event.data.hash).then(() => drainPrefetchQueue()),
    );
  } else if (type === "RESUME_PREFETCH") {
    event.waitUntil(drainPrefetchQueue());
  } else if (type === "REPLAY_OUTBOX") {
    event.waitUntil(replayOutbox());
  }
});

// --- Persistent prefetch queue ---

function openPrefetchDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PREFETCH_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(PREFETCH_QUEUE, { keyPath: "url" });
      db.createObjectStore(PREFETCH_META, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function getPrefetchMeta(db) {
  return idbRequest(
    db
      .transaction(PREFETCH_META, "readonly")
      .objectStore(PREFETCH_META)
      .get("current"),
  ).then((row) => row ?? null);
}

function getQueuedUrls(db) {
  return idbRequest(
    db
      .transaction(PREFETCH_QUEUE, "readonly")
      .objectStore(PREFETCH_QUEUE)
      .getAll(),
  );
}

// Seeds the queue for a new pass. If the same list (by hash) is already
// queued or in flight, keeps the leftover queue so completed URLs aren't
// refetched — the drain just resumes. A different hash means the route list
// changed, but only URLs missing from the cache are queued: new entities
// get fetched, already-cached pages are left alone, and URLs that failed a
// previous pass are retried for free since they're simply absent.
async function seedPrefetchQueue(urls, hash) {
  const db = await openPrefetchDb();
  try {
    const meta = await getPrefetchMeta(db);
    if (meta && meta.hash === hash) return;

    const cache = await caches.open(PAGES_CACHE);
    const cached = new Set((await cache.keys()).map((r) => r.url));
    const missing = urls.filter((url) => {
      const absolute = new URL(url, self.location.origin).toString();
      if (!cached.has(absolute)) return true;
      if (absolute.includes("/api/")) return false;
      const rscKey = new URL(absolute);
      rscKey.searchParams.set("__sw_rsc", "1");
      return !cached.has(rscKey.toString());
    });

    await idbDone(
      (() => {
        const tx = db.transaction(PREFETCH_QUEUE, "readwrite");
        const store = tx.objectStore(PREFETCH_QUEUE);
        store.clear();
        for (const url of missing) store.put({ url });
        return tx;
      })(),
    );
    await idbDone(
      (() => {
        const tx = db.transaction(PREFETCH_META, "readwrite");
        tx.objectStore(PREFETCH_META).put({
          key: "current",
          hash,
          total: missing.length,
        });
        return tx;
      })(),
    );
  } finally {
    db.close();
  }
}

// Always re-fetches and overwrites — this is the periodic recache, not just
// a fill-missing pass. Each URL is removed from the persisted queue once
// fetched, so a killed worker resumes on activate instead of restarting.
// Entries whose fetch throws (e.g. went offline) stay queued for the next
// drain; each entry is attempted at most once per drain call.
async function drainPrefetchQueue() {
  if (prefetchDraining) return;
  prefetchDraining = true;
  try {
    const db = await openPrefetchDb();
    const cache = await caches.open(PAGES_CACHE);
    const attempted = new Set();
    try {
      for (;;) {
        const meta = await getPrefetchMeta(db);
        const queued = await getQueuedUrls(db);
        const total = meta?.total ?? queued.length;
        const remaining = queued.filter((e) => !attempted.has(e.url));
        if (remaining.length === 0) break;

        let done = total - queued.length;
        notifyClients({ type: "PREFETCH_PROGRESS", done, total });

        for (let i = 0; i < remaining.length; i += PREFETCH_CONCURRENCY) {
          await Promise.all(
            remaining.slice(i, i + PREFETCH_CONCURRENCY).map(async (entry) => {
              attempted.add(entry.url);
              try {
                await prefetchOne(cache, entry.url);
                await idbDone(
                  db
                    .transaction(PREFETCH_QUEUE, "readwrite")
                    .objectStore(PREFETCH_QUEUE)
                    .delete(entry.url).transaction,
                );
                done += 1;
              } catch {
                // Network failed — leave queued for the next drain
              }
            }),
          );
          notifyClients({ type: "PREFETCH_PROGRESS", done, total });
        }
      }

      // Only finish the pass when the queue is truly empty — entries left
      // behind failed mid-pass and stay queued for the next drain.
      const leftover = await getQueuedUrls(db);
      const meta = await getPrefetchMeta(db);
      if (leftover.length === 0 && meta) {
        await idbDone(
          db
            .transaction(PREFETCH_META, "readwrite")
            .objectStore(PREFETCH_META)
            .delete("current").transaction,
        );
        notifyClients({ type: "PREFETCH_DONE", hash: meta.hash });
      }
    } finally {
      db.close();
    }
  } catch {
    // IndexedDB unavailable — nothing to resume
  } finally {
    prefetchDraining = false;
  }
}

async function prefetchOne(cache, url) {
  const absolute = new URL(url, self.location.origin).toString();
  const response = await fetch(url, { credentials: "same-origin" });
  if (response.ok && !response.redirected) {
    await safePut(cache, pageCacheKey(new Request(absolute)), response.clone());
  }
  // Warm the RSC payload too so client-side navigation works offline
  if (!absolute.includes("/api/")) {
    const rscResponse = await fetch(url, {
      credentials: "same-origin",
      headers: { rsc: "1" },
    });
    if (rscResponse.ok && !rscResponse.redirected) {
      await safePut(
        cache,
        pageCacheKey(new Request(absolute, { headers: { rsc: "1" } })),
        rscResponse.clone(),
      );
    }
  }
}

// --- Push notifications ---

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
