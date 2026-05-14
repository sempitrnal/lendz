"use client";

import { useScheduleSelection } from "./schedule-selection-provider";
import { ScheduleCheckbox } from "./schedule-checkbox";

export function ScheduleMobileCard({
  scheduleId,
  children,
  className,
}: {
  scheduleId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isEditing, isSelected, toggleId } = useScheduleSelection();
  const selected = isSelected(scheduleId);

  return (
    <li
      onClick={() => {
        if (isEditing) toggleId(scheduleId);
      }}
      className={`${className} ${isEditing ? "cursor-pointer" : ""} ${
        selected ? "outline-dashed outline-4 outline-offset-[-2px] outline-blue-500 bg-yellow-100" : ""
      }`}
    >
      {children}
    </li>
  );
}
