import type { SupabaseClient } from "@supabase/supabase-js";
import { dropSchedulesFromLabel } from "@/lib/checklist/drop-schedules";

type Db = Pick<SupabaseClient, "from">;

const DAY_MS = 86_400_000;
const utcDay = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * Whether a schedule would be on `date`'s list without a payment putting it
 * there: due that day, or up to 7 days late (what "populate due" adds). Only
 * a schedule outside that, such as one paid ahead or one long overdue, was
 * listed by the payment itself.
 */
export function listedByPopulate(dueDate: string, date: string): boolean {
  const late = Math.round((utcDay(date) - utcDay(dueDate)) / DAY_MS);
  return late >= 0 && late <= 7;
}

/**
 * Takes a schedule back off `date`'s checklist after its payment was undone:
 * the row goes when it linked nothing else, otherwise just its line goes.
 * It stays when another payment on that day still keeps it there, when the
 * day would list it anyway, or when the row is already ticked off. Never
 * throws: the undo is already saved.
 */
export async function unlistScheduleFromDay(
  supabase: Db,
  date: string,
  scheduleId: string,
): Promise<number> {
  try {
    const day = date.slice(0, 10);
    const { data: schedule } = await supabase
      .from("payment_schedules")
      .select("id, due_date")
      .eq("id", scheduleId)
      .single();
    if (!schedule) return 0;
    if (listedByPopulate(String(schedule.due_date).slice(0, 10), day)) return 0;

    const { data: stillPaid } = await supabase
      .from("schedule_payments")
      .select("id")
      .eq("schedule_id", scheduleId)
      .eq("payment_date", day)
      .limit(1);
    if ((stillPaid ?? []).length > 0) return 0;

    const { data: items } = await supabase
      .from("daily_checklist_items")
      .select("id, label, is_checked")
      .eq("checklist_date", day)
      .ilike("label", `%${scheduleId}%`);

    let changed = 0;
    for (const item of (items ?? []) as {
      id: string;
      label: string;
      is_checked: boolean;
    }[]) {
      if (item.is_checked) continue;
      const result = dropSchedulesFromLabel(item.label, new Set([scheduleId]));
      if (result.kind === "delete") {
        await supabase.from("daily_checklist_items").delete().eq("id", item.id);
        changed += 1;
      } else if (result.kind === "update") {
        await supabase
          .from("daily_checklist_items")
          .update({ label: result.label })
          .eq("id", item.id);
        changed += 1;
      }
    }
    return changed;
  } catch (e) {
    console.warn("checklist cleanup failed:", e);
    return 0;
  }
}
