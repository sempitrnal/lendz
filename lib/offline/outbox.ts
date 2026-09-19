const OUTBOX_DB = "lendz-outbox";
const OUTBOX_STORE = "requests";

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

export async function getPendingOutboxCount(): Promise<number> {
  try {
    const db = await openOutboxDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(OUTBOX_STORE, "readonly");
        const req = tx.objectStore(OUTBOX_STORE).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return 0;
  }
}
