import { extractScheduleRefs } from "@/lib/checklist/labels";

/**
 * The labels whose linked schedules aren't all saved on the device yet: the
 * ones worth warming after rows arrive (added here, by realtime, populate or
 * a manual payment). Labels without links, or fully saved, are skipped.
 */
export function labelsNeedingWarm(
  labels: string[],
  isCached: (scheduleId: string) => boolean,
): string[] {
  return [
    ...new Set(
      labels.filter((label) =>
        extractScheduleRefs(label).some((ref) => !isCached(ref.id)),
      ),
    ),
  ];
}
