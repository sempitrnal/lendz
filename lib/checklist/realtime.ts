import type { DailyChecklistItem } from "@/lib/checklist/types";

/** A realtime change to a checklist row, as far as the echo check reads it. */
export type ItemChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Partial<DailyChecklistItem> & { id?: string };
  old: { id?: string };
};

/** True when the change is already what the screen shows (our own write). */
export function isEchoOfLocalState(
  payload: ItemChangePayload,
  current: DailyChecklistItem[],
): boolean {
  if (payload.eventType === "DELETE") {
    return !current.some((row) => row.id === payload.old?.id);
  }
  const next = payload.new;
  const local = current.find((row) => row.id === next?.id);
  if (!local) return false;
  return (
    local.label === next.label &&
    local.is_checked === next.is_checked &&
    Number(local.sort_order) === Number(next.sort_order) &&
    (local.category_id ?? null) === (next.category_id ?? null)
  );
}
