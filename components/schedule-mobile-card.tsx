"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useScheduleSelection } from "./schedule-selection-provider";

export function ScheduleMobileCard({
  scheduleId,
  children,
  actions,
  footer,
  className,
  id,
  defaultOpen = false,
}: {
  scheduleId: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  id?: string;
  defaultOpen?: boolean;
}) {
  const { isEditing, isSelected, toggleId } = useScheduleSelection();
  const selected = isSelected(scheduleId);
  const [open, setOpen] = useState(defaultOpen);

  function handleTap() {
    if (isEditing) { toggleId(scheduleId); return; }
    if (actions) setOpen((v) => !v);
  }

  return (
    <li
      id={id}
      className={`${className} ${selected ? "bg-cyan-300 dark:bg-cyan-900/20" : ""}`}
    >
      <div
        onClick={handleTap}
        className={`flex items-start justify-between gap-3 ${isEditing || actions ? "cursor-pointer" : ""}`}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {actions && !isEditing && (
          <ChevronDown
            className={`mt-1 size-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {actions && (
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-900 pt-3 mt-3">
              {actions}
            </div>
          </div>
        </div>
      )}

      {footer && (
        <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-900 pt-3 mt-3">
          {footer}
        </div>
      )}
    </li>
  );
}
