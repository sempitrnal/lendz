import { extractBorrowerMention } from "@/lib/checklist/labels";
import {
  parseReleasedLabel,
  type ParsedReleasedLabel,
} from "@/lib/checklist/released";
import type { DailyChecklistItem } from "@/lib/checklist/types";

export type ReleaseRowView = {
  item: DailyChecklistItem;
  parsed: ParsedReleasedLabel | null;
  name: string;
  /** The label as typed: the mention link collapsed to the borrower's name. */
  typed: string;
  created: boolean;
};

export function buildReleaseView(item: DailyChecklistItem): ReleaseRowView {
  const mention = extractBorrowerMention(item.label);
  const typed = item.label
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return {
    item,
    parsed: parseReleasedLabel(item.label, item.checklist_date),
    name: mention?.name ?? "",
    typed,
    created: item.is_checked,
  };
}
