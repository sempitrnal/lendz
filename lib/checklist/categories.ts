import { extractScheduleRefs } from "@/lib/checklist/labels";
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

/**
 * The tab an item shows on. Released-category items are releases, except a
 * row that links installments (`#badge:date:…|<scheduleId>`): that is a
 * collection filed under "released" and goes to Collect, where it can be
 * paid like any other. (Owner ruling, final review I4; to go back to the
 * category-only rule, drop the `extractScheduleRefs` condition.)
 */
export function tabOf(
  item: DailyChecklistItem,
  releasedId: string | null,
): ChecklistTab {
  return releasedId !== null &&
    item.category_id === releasedId &&
    extractScheduleRefs(item.label).length === 0
    ? "release"
    : "collect";
}
