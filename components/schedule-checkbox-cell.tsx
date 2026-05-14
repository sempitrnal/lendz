"use client";

import { useScheduleSelection } from "./schedule-selection-provider";

export function ScheduleCheckboxCell({
  scheduleId,
  className,
}: {
  scheduleId: string;
  className: string;
}) {
  const { isSelected, toggleId, isEditing } = useScheduleSelection();
  if (!isEditing) return null;

  const checked = isSelected(scheduleId);

  return (
    <td className={className}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggleId(scheduleId)}
        className="size-4 shrink-0 cursor-pointer accent-slate-900"
        aria-label={`Select schedule ${scheduleId}`}
      />
    </td>
  );
}
