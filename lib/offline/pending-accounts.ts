import { readStored, writeStored } from "@/lib/offline/storage";

/**
 * Accounts created while the connection was slow or down. The create requests
 * wait in the service worker's outbox; this keeps a copy of each account so the
 * borrower page can show it right away, until the server list includes it.
 */
export type PendingAccount = Record<string, unknown> & {
  id: string;
  borrower_id: string;
  /** Marks it as not yet on the server. */
  pendingSync: true;
  savedAt: number;
};

const EVENT = "lendz-pending-accounts";
/** An account whose request never went through is dropped after this long. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const keyFor = (borrowerId: string) => `lendz-pending-accounts:${borrowerId}`;

export function readPendingAccounts(borrowerId: string): PendingAccount[] {
  const now = Date.now();
  return (readStored<PendingAccount[]>(keyFor(borrowerId)) ?? []).filter(
    (a) => now - a.savedAt < MAX_AGE_MS,
  );
}

/** Ids made offline this session whose local copy has since been dropped. */
const arrived = new Set<string>();

/** Whether this device made the account offline (still waiting or landed). */
export function wasMadeOffline(id: string): boolean {
  return arrived.has(id) || pendingAccountIdSet().has(id);
}

function pendingAccountIdSet(): Set<string> {
  const ids = new Set<string>();
  for (const borrowerId of pendingAccountBorrowerIds()) {
    for (const a of readPendingAccounts(borrowerId)) ids.add(a.id);
  }
  return ids;
}

function write(borrowerId: string, accounts: PendingAccount[]) {
  const kept = new Set(accounts.map((a) => a.id));
  for (const a of readPendingAccounts(borrowerId)) {
    if (!kept.has(a.id)) arrived.add(a.id);
  }
  writeStored(keyFor(borrowerId), accounts);
  window.dispatchEvent(new Event(EVENT));
}

export function addPendingAccount(
  borrowerId: string,
  account: Record<string, unknown> & { id: string },
) {
  const next: PendingAccount = {
    ...account,
    borrower_id: borrowerId,
    pendingSync: true,
    savedAt: Date.now(),
  };
  write(borrowerId, [
    ...readPendingAccounts(borrowerId).filter((a) => a.id !== next.id),
    next,
  ]);
}

/** Drops the ones the server now lists. */
export function prunePendingAccounts(
  borrowerId: string,
  serverIds: Set<string>,
) {
  const current = readPendingAccounts(borrowerId);
  const next = current.filter((a) => !serverIds.has(a.id));
  if (next.length !== current.length) write(borrowerId, next);
}

export function subscribePendingAccounts(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Forgets every locally kept pending account (used when the queue is cleared). */
export function clearAllPendingAccounts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("lendz-pending-accounts:"))
        localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Borrowers that have accounts waiting locally. */
export function pendingAccountBorrowerIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("lendz-pending-accounts:")) {
        const borrowerId = key.slice("lendz-pending-accounts:".length);
        if (readPendingAccounts(borrowerId).length > 0) ids.push(borrowerId);
      }
    }
  } catch {
    // Storage unavailable
  }
  return ids;
}

/**
 * Drops local copies whose create request has left the outbox (it went
 * through, or was rejected); the server's list takes over from here.
 */
export function dropSyncedPendingAccounts(stillQueued: Set<string>) {
  for (const borrowerId of pendingAccountBorrowerIds()) {
    const current = readPendingAccounts(borrowerId);
    const next = current.filter((a) => stillQueued.has(a.id));
    if (next.length !== current.length) write(borrowerId, next);
  }
}

const STALE_KEY = "lendz-borrowers-to-refresh";

/**
 * Remembers a borrower whose page needs a server refresh once queued changes
 * land (e.g. an account deleted offline), since the change itself can't
 * refresh anything while it waits.
 */
export function markBorrowerForRefresh(borrowerId: string) {
  const ids = readStored<string[]>(STALE_KEY) ?? [];
  if (!ids.includes(borrowerId)) writeStored(STALE_KEY, [...ids, borrowerId]);
}

/** Borrowers whose pages should be refreshed after a sync; clears the list. */
export function takeBorrowersForRefresh(): string[] {
  const ids = readStored<string[]>(STALE_KEY) ?? [];
  if (ids.length > 0) writeStored(STALE_KEY, []);
  return ids;
}
