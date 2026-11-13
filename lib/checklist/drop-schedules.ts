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
