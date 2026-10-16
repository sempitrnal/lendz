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

function write(borrowerId: string, accounts: PendingAccount[]) {
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
