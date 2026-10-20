import type {
  ChecklistCategory,
  DailyChecklistItem,
} from "@/lib/checklist/types";

export type ChecklistTab = "collect" | "release";

const norm = (name: string) => name.trim().toLowerCase();

/**
 * The categories the Collect and Release tabs map onto. Released is the
 * category named "released". Collect (used for new items) is the one named
 * "received", else the first non-released by sort_order, else null.
 */
export function resolveCategoryIds(categories: ChecklistCategory[]): {
  releasedId: string | null;
  collectId: string | null;
} {
  const released = categories.find((c) => norm(c.name) === "released");
  const others = categories
    .filter((c) => c.id !== released?.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const received = others.find((c) => norm(c.name) === "received");
  return {
    releasedId: released?.id ?? null,
    collectId: (received ?? others[0])?.id ?? null,
  };
}

export function tabOf(
  item: DailyChecklistItem,
  releasedId: string | null,
): ChecklistTab {
  return releasedId !== null && item.category_id === releasedId
    ? "release"
    : "collect";
}
