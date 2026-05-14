"use client";

import { useScheduleSelection } from "./schedule-selection-provider";

export function ScheduleSelectAllHeader({
  className,
  allIds,
}: {
  className: string;
  allIds: string[];
}) {
  const { selectedIds, selectAll, clearAll, isEditing } = useScheduleSelection();
  if (!isEditing) return null;

  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  return (
    <th scope="col" className={className}>
      <input
        type="checkbox"
        checked={allSelected}
        onChange={() => {
          if (allSelected) clearAll();
          else selectAll(allIds);
        }}
        className="size-4 shrink-0 cursor-pointer accent-slate-900"
        aria-label="Select all schedules"
      />
    </th>
  );
}
