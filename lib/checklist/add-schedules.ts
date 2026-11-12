import type { SupabaseClient } from "@supabase/supabase-js";
import { newRowSortOrders } from "@/lib/checklist/day-items";
import { resolveCategoryIds } from "@/lib/checklist/categories";
import {
  buildDueLabel,
  extractBorrowerMention,
  extractScheduleRefs,
  parseExistingNext,
  rewriteNextBlock,
} from "@/lib/checklist/labels";
import type {
  DailyChecklistItem,
  DueChecklistItem,
} from "@/lib/checklist/types";

type Db = Pick<SupabaseClient, "from">;
type One<T> = T | T[] | null | undefined;
const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? v[0] : v) ?? null;

type ScheduleRow = {
  id: string;
  due_date: string;
  amount_due: number | null;
  accounts: One<{
    type: string;
    schedule_mode: string | null;
    borrower_id: string;
    borrowers: One<{ first_name: string; last_name: string }>;
  }>;
};

/**
 * Makes sure schedules that were just paid (or part-paid) outside the
 * checklist show on `date`'s list:
 *
 * - A schedule the day already lists is left alone.
 * - The borrower already has a collection row that day: the schedule is
 *   appended under it.
 * - Otherwise a new row is added in the Collect category.
 *
 * Manual-schedule accounts are skipped (the checklist records those another
 * way). Safe to run twice.
 */
export async function addSchedulesToChecklist(
  supabase: Db,
  date: string,
  scheduleIds: string[],
): Promise<{ added: number; appended: number }> {
  const ids = [...new Set(scheduleIds.filter(Boolean))];
  if (ids.length === 0) return { added: 0, appended: 0 };

  const { data: schedules, error } = await supabase
    .from("payment_schedules")
    .select(
      "id, due_date, amount_due, accounts!inner(type, schedule_mode, borrower_id, borrowers!inner(first_name, last_name))",
    )
    .in("id", ids);
  if (error) throw new Error(error.message);

  const { data: dayItems, error: itemsError } = await supabase
    .from("daily_checklist_items")
    .select("id, label, sort_order, category_id, is_checked")
    .eq("checklist_date", date);
  if (itemsError) throw new Error(itemsError.message);
  const items = (dayItems ?? []) as DailyChecklistItem[];
  const listed = new Set(
    items.flatMap((i) => extractScheduleRefs(i.label).map((r) => r.id)),
  );

  // What to add, per borrower.
  const byBorrower = new Map<
    string,
    { name: string; items: DueChecklistItem[] }
  >();
  for (const raw of (schedules ?? []) as unknown as ScheduleRow[]) {
    const account = one(raw.accounts);
    const borrower = one(account?.borrowers);
    if (!account || !borrower || account.schedule_mode === "manual") continue;
    if (listed.has(raw.id)) continue;
    if (account.type !== "loan" && account.type !== "cash_advance") continue;
    const group = byBorrower.get(account.borrower_id) ?? {
      name: `${borrower.first_name} ${borrower.last_name}`.trim(),
      items: [],
    };
    group.items.push({
      id: raw.id,
      due_date: String(raw.due_date).slice(0, 10),
      amount: Math.max(0, Number(raw.amount_due ?? 0)),
      type: account.type,
    });
    byBorrower.set(account.borrower_id, group);
  }
  if (byBorrower.size === 0) return { added: 0, appended: 0 };

  let appended = 0;
  const fresh: { borrowerId: string; label: string }[] = [];
  for (const [borrowerId, group] of byBorrower) {
    const row = items.find(
      (i) =>
        extractScheduleRefs(i.label).length > 0 &&
        extractBorrowerMention(i.label)?.id === borrowerId,
    );
    if (row) {
      const merged = [...parseExistingNext(row.label), ...group.items].sort(
        (a, b) => a.due_date.localeCompare(b.due_date),
      );
      const { error: updateError } = await supabase
        .from("daily_checklist_items")
        .update({ label: rewriteNextBlock(row.label, merged) })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      appended += group.items.length;
    } else {
      fresh.push({
        borrowerId,
        label: buildDueLabel({
          borrower_id: borrowerId,
          name: group.name,
          items: group.items.sort((a, b) =>
            a.due_date.localeCompare(b.due_date),
          ),
        }),
      });
    }
  }

  if (fresh.length > 0) {
    const { data: categories, error: categoriesError } = await supabase
      .from("daily_checklist_categories")
      .select("id, name, color, sort_order");
    if (categoriesError) throw new Error(categoriesError.message);
    const { collectId } = resolveCategoryIds(categories ?? []);
    const rows = fresh.map(() => ({ categoryId: collectId }));
    const sortOrders = newRowSortOrders(items, rows);
    const { error: insertError } = await supabase
      .from("daily_checklist_items")
      .insert(
        fresh.map((f, i) => ({
          id: crypto.randomUUID(),
          checklist_date: date,
          label: f.label,
          is_checked: false,
          sort_order: sortOrders[i],
          category_id: collectId,
        })),
      );
    if (insertError) throw new Error(insertError.message);
  }

  return { added: fresh.length, appended };
}
