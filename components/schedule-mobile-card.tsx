"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
    if (isEditing) {
      toggleId(scheduleId);
      return;
    }
    if (actions) setOpen((v) => !v);
  }

  return (
    <li
      id={id}
      className={cn(
        `relative overflow-hidden rounded-2xl border border-slate-200 bg-white
        shadow-sm transition hover:shadow-md dark:border-slate-800
        dark:bg-slate-900`,
        className,
        selected && "ring-2 ring-cyan-400 dark:ring-cyan-500",
      )}
    >
      <div
        onClick={handleTap}
        className={cn(
          "flex items-start justify-between gap-3 px-4 py-4",
          (isEditing || actions) && "cursor-pointer",
        )}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {actions && !isEditing && (
          <ChevronDown
            className={cn(
              `mt-1 size-4 shrink-0 text-slate-400 transition-transform
              duration-200`,
              open && "rotate-180",
            )}
          />
        )}
      </div>

      {actions && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div
              className={`border-t border-slate-200 px-4 py-4
              dark:border-slate-800`}
            >
              {actions}
            </div>
          </div>
        </div>
      )}

      {footer && (
        <div
          className="border-t border-slate-200 px-4 py-4 dark:border-slate-800"
        >
          {footer}
        </div>
      )}
    </li>
  );
}
