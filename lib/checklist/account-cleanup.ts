import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
  extractScheduleRefs,
  parseExistingNext,
  rewriteNextBlock,
} from "@/lib/checklist/labels";

export type LabelCleanup =
  | { kind: "keep" }
  | { kind: "delete" }
  | { kind: "update"; label: string };

/**
 * What becomes of a checklist item once some installments are gone: kept
 * when it links none of them, deleted when it links nothing else, and
 * otherwise rewritten without their lines (the total redone).
 */
export function dropSchedulesFromLabel(
  label: string,
  gone: ReadonlySet<string>,
): LabelCleanup {
  const refs = extractScheduleRefs(label);
  if (!refs.some((r) => gone.has(r.id))) return { kind: "keep" };
  if (refs.every((r) => gone.has(r.id))) return { kind: "delete" };
  const left = parseExistingNext(label).filter((i) => !gone.has(i.id));
  return { kind: "update", label: rewriteNextBlock(label, left) };
}

/** Ids per `or()` filter, so the request URL stays short. */
const CHUNK = 20;

/**
 * Takes deleted accounts off the checklist: every item that links one of
 * their installments loses those lines, and goes when nothing else is left.
 * Returns how many items it deleted or changed.
 */
export async function removeAccountsFromChecklist(
  accountIds: string[],
): Promise<number> {
  if (accountIds.length === 0) return 0;
  const { data: schedules, error } = await supabase
    .from("payment_schedules")
    .select("id")
    .in("account_id", accountIds);
  if (error) throw error;
  const gone = new Set<string>(
    ((schedules ?? []) as { id: string }[]).map((s) => s.id),
  );
  if (gone.size === 0) return 0;

  // The labels carry the ids (`#badge:date:YYYY-MM-DD|<id>`).
  const ids = [...gone];
  const items = new Map<string, string>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const filter = ids
      .slice(i, i + CHUNK)
      // The bare id: `|` and `)` would break the `or()` syntax, and a
      // uuid is unique on its own.
      .map((id) => `label.ilike.%${id}%`)
      .join(",");
    const { data, error: itemsError } = await supabase
      .from("daily_checklist_items")
      .select("id, label")
      .or(filter);
    if (itemsError) throw itemsError;
    for (const item of (data ?? []) as { id: string; label: string }[]) {
      items.set(item.id, item.label);
    }
  }

  const toDelete: string[] = [];
  const toUpdate: { id: string; label: string }[] = [];
  for (const [id, label] of items) {
    const result = dropSchedulesFromLabel(label, gone);
    if (result.kind === "delete") toDelete.push(id);
    else if (result.kind === "update")
      toUpdate.push({ id, label: result.label });
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("daily_checklist_items")
      .delete()
      .in("id", toDelete);
    if (deleteError) throw deleteError;
  }
  for (const { id, label } of toUpdate) {
    const { error: updateError } = await supabase
      .from("daily_checklist_items")
      .update({ label })
      .eq("id", id);
    if (updateError) throw updateError;
  }
  return toDelete.length + toUpdate.length;
}

/**
 * `removeAccountsFromChecklist` after an account delete has gone through: a
 * failure here never undoes the delete, it only says the checklist kept them.
 */
export async function cleanUpChecklistAfterDelete(accountIds: string[]) {
  try {
    await removeAccountsFromChecklist(accountIds);
  } catch {
    toast.warning(
      "Account deleted, but its checklist items couldn't be removed.",
    );
  }
}
