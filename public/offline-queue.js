const DB_NAME = "lendz-offline-queue";
const DB_VERSION = 1;
const STORE = "requests";

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueRequest(request) {
  const cloned = request.clone();
  const body = await cloned.text().catch(() => "");
  const headers = [];
  cloned.headers.forEach((value, key) => headers.push([key, value]));

  const entry = {
    url: request.url,
    method: request.method,
    headers,
    body,
    mode: request.mode,
    credentials: request.credentials,
    referrer: request.referrer,
    timestamp: Date.now(),
  };

  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const addReq = store.add(entry);
    addReq.onsuccess = () => resolve(addReq.result);
    addReq.onerror = () => reject(addReq.error);
  });
}

async function getQueuedRequests() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const getReq = store.getAll();
    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => reject(getReq.error);
  });
}

async function removeQueuedRequest(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const delReq = store.delete(id);
    delReq.onsuccess = () => resolve();
    delReq.onerror = () => reject(delReq.error);
  });
}

function buildRequest(entry) {
  const headers = new Headers();
  for (const [k, v] of entry.headers) headers.append(k, v);
  const body = entry.body ? entry.body : null;
  return new Request(entry.url, {
    method: entry.method,
    headers,
    body,
    mode: entry.mode,
    credentials: entry.credentials,
    referrer: entry.referrer,
  });
}

async function syncQueuedRequests() {
  const queue = await getQueuedRequests();
  for (const entry of queue) {
    try {
      const request = buildRequest(entry);
      const res = await fetch(request);
      if (res.ok || (res.status >= 200 && res.status < 500)) {
        await removeQueuedRequest(entry.id);
      } else {
        console.warn("[SW] Queued request returned non-ok status", res.status, entry.url);
      }
    } catch (e) {
      console.error("[SW] Failed to replay queued request", entry.id, e);
    }
  }

  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: "SYNC_COMPLETE" }));
  } catch {
    // ignore
  }
}
