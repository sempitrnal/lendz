export const RECENT_BORROWERS_KEY = "lendz:recent-borrowers";
export const RECENT_BORROWERS_CHANGED = "lendz:recent-borrowers-changed";

function notifyRecentBorrowersChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RECENT_BORROWERS_CHANGED));
}

export type RecentBorrower = {
  id: string;
  first_name: string;
  last_name: string;
  categoryColor: string | null;
  visitCount: number;
};

export function loadRecentBorrowers(): RecentBorrower[] {
  try {
    const raw = localStorage.getItem(RECENT_BORROWERS_KEY);
    if (raw) {
      const parsed: unknown[] = JSON.parse(raw);
      return parsed
        .filter(
          (b): b is RecentBorrower =>
            typeof b === "object" &&
            b !== null &&
            "id" in b &&
            typeof (b as Record<string, unknown>).id === "string",
        )
        .map((b) => ({
          id: b.id,
          first_name: b.first_name ?? "",
          last_name: b.last_name ?? "",
          categoryColor: b.categoryColor ?? null,
          visitCount: b.visitCount ?? 1,
        }));
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveRecentBorrower(borrower: {
  id: string;
  first_name: string;
  last_name: string;
  categoryColor: string | null;
}): RecentBorrower[] {
  try {
    const current = loadRecentBorrowers();
    const existing = current.find((b) => b.id === borrower.id);
    const count = (existing?.visitCount ?? 0) + 1;
    const filtered = current.filter((b) => b.id !== borrower.id);
    const next: RecentBorrower[] = [
      { ...borrower, visitCount: count },
      ...filtered,
    ].slice(0, 10);
    localStorage.setItem(RECENT_BORROWERS_KEY, JSON.stringify(next));
    notifyRecentBorrowersChanged();
    return next;
  } catch {
    return [];
  }
}

export function clearRecentBorrowers(): void {
  try {
    localStorage.removeItem(RECENT_BORROWERS_KEY);
    notifyRecentBorrowersChanged();
  } catch {
    // ignore
  }
}
