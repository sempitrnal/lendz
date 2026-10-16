const OUTBOX_DB = "lendz-outbox";
const OUTBOX_STORE = "requests";

type OutboxEntry = { failed?: boolean; attempts?: number } & Record<
  string,
  unknown
>;

function openOutboxDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(OUTBOX_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openOutboxDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, mode);
      const req = fn(tx.objectStore(OUTBOX_STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Entries waiting to be sent, and ones parked after repeated server errors. */
export async function getOutboxStatus(): Promise<{
  pending: number;
  failed: number;
}> {
  try {
    const entries = await withStore<OutboxEntry[]>("readonly", (s) =>
      s.getAll(),
    );
    const failed = entries.filter((e) => e.failed).length;
    return { pending: entries.length - failed, failed };
  } catch {
    return { pending: 0, failed: 0 };
  }
}

/** Changes still waiting to go out (parked ones don't count). */
export async function getPendingOutboxCount(): Promise<number> {
  return (await getOutboxStatus()).pending;
}

/** Throws away everything queued, parked entries included. */
export async function clearOutbox(): Promise<void> {
  await withStore("readwrite", (s) => s.clear());
}

/** Gives parked entries another go: forgets their failures. */
export async function retryFailedOutbox(): Promise<void> {
  const db = await openOutboxDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      const store = tx.objectStore(OUTBOX_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const value = cursor.value as OutboxEntry;
        if (value.failed) {
          cursor.update({ ...value, failed: false, attempts: 0 });
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Asks the service worker to send what's queued now, passing along the
 * current access token so old writes don't replay with an expired one.
 */
export async function requestOutboxReplay() {
  if (!("serviceWorker" in navigator)) return;
  let accessToken: string | undefined;
  try {
    // Loaded lazily so modules that only ask for a replay stay light.
    const { supabase } = await import("@/lib/supabase/client");
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 4000),
      ),
    ]);
    accessToken = data.session?.access_token;
  } catch {
    // Replay with the tokens stored on each entry
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "REPLAY_OUTBOX", accessToken });
  } catch {
    // No worker
  }
}
