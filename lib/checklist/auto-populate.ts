import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDueGroups } from "@/lib/checklist/due-groups";
import { newRowSortOrders } from "@/lib/checklist/day-items";
import { resolveCategoryIds } from "@/lib/checklist/categories";
import { selectPopulateLabels } from "@/lib/checklist/populate";
import type { DailyChecklistItem } from "@/lib/checklist/types";

/** Unpaid schedules carry over onto the checklist this many days (as the app's Populate due). */
const CARRY_OVER_DAYS = 7;

/** The Philippine calendar day (UTC+8, no daylight saving) for an instant. */
export function manilaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(now);
}

/**
 * "Populate due" for one day without anyone at the screen: one row per
 * borrower with something due that day (or up to 7 days late) who isn't
 * listed yet, in the Collect category. Safe to run twice: what is already
 * listed is skipped. Needs a client that can write the checklist (the cron
 * passes the service-role one).
 */
export async function populateDay(
  supabase: Pick<SupabaseClient, "from">,
  date: string,
): Promise<{ added: number }> {
  const { data: categories, error: categoriesError } = await supabase
    .from("daily_checklist_categories")
    .select("id, name, color, sort_order");
  if (categoriesError) throw new Error(categoriesError.message);
  const { collectId } = resolveCategoryIds(categories ?? []);

  const { data: existing, error: existingError } = await supabase
    .from("daily_checklist_items")
    .select("id, label, sort_order, category_id")
    .eq("checklist_date", date);
  if (existingError) throw new Error(existingError.message);
  const items = (existing ?? []) as DailyChecklistItem[];

  const groups = await loadDueGroups(supabase, date, CARRY_OVER_DAYS);
  const labels = selectPopulateLabels(groups, items);
  if (labels.length === 0) return { added: 0 };

  const rows = labels.map((label) => ({ label, categoryId: collectId }));
  const sortOrders = newRowSortOrders(items, rows);
  const createdAt = new Date().toISOString();
  const { error } = await supabase.from("daily_checklist_items").insert(
    rows.map((row, i) => ({
      id: crypto.randomUUID(),
      checklist_date: date,
      label: row.label,
      is_checked: false,
      sort_order: sortOrders[i],
      created_at: createdAt,
      ...(row.categoryId ? { category_id: row.categoryId } : {}),
    })),
  );
  if (error) throw new Error(error.message);
  return { added: labels.length };
}
