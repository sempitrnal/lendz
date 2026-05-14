"use client";

import { useScheduleSelection } from "./schedule-selection-provider";

export function ScheduleCheckbox({ scheduleId }: { scheduleId: string }) {
  const { isSelected, toggleId, isEditing } = useScheduleSelection();
  const checked = isSelected(scheduleId);

  if (!isEditing) return null;

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        e.stopPropagation();
        toggleId(scheduleId);
      }}
      className="size-4 shrink-0 cursor-pointer accent-slate-900"
      aria-label={`Select schedule ${scheduleId}`}
    />
  );
}
