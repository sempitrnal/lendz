import {
  buildDueLabel,
  extractBorrowerMention,
  extractScheduleRefs,
} from "@/lib/checklist/labels";
import type { DueChecklistGroup } from "@/lib/checklist/types";

/**
 * Labels for the rows "populate" should add: one per borrower with something
 * due that isn't already listed on the day.
 */
export function selectPopulateLabels(
  groups: DueChecklistGroup[],
  existing: { label: string }[],
): string[] {
  const already = new Set(
    existing.flatMap((i) => extractScheduleRefs(i.label).map((r) => r.id)),
  );
  // Borrowers who already have a collection row on the day are skipped so
  // they don't get a second one; "Add carry-over" tops those rows up.
  const listedBorrowers = new Set(
    existing
      .filter((i) => extractScheduleRefs(i.label).length > 0)
      .flatMap((i) => extractBorrowerMention(i.label)?.id ?? []),
  );
  return groups
    .filter((g) => !listedBorrowers.has(g.borrower_id))
    .map((g) => ({ ...g, items: g.items.filter((i) => !already.has(i.id)) }))
    .filter((g) => g.items.length > 0)
    .map(buildDueLabel);
}
