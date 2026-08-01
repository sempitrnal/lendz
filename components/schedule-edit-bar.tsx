"use client";

import { useScheduleSelection } from "./schedule-selection-provider";
import { ScheduleSelectAll } from "./schedule-select-all";
import { Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScheduleEditBar({ allIds }: { allIds: string[] }) {
  const { isEditing, setIsEditing, selectedIds } = useScheduleSelection();
  const selectedCount = selectedIds.size;

  return (
    <div
      className="flex items-center justify-between rounded-xl border
        border-slate-200 bg-white px-3 py-2 shadow-sm print:hidden
        dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <ScheduleSelectAll allIds={allIds} />
            <span
              className="text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              Select all
            </span>
            {selectedCount > 0 ? (
              <span
                className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px]
                  font-bold text-sky-700 dark:bg-sky-800/50 dark:text-sky-300"
              >
                {selectedCount} selected
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-xs font-semibold text-slate-500
            dark:text-slate-400">
            {allIds.length} schedule{allIds.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsEditing(!isEditing)}
        aria-pressed={isEditing}
        className={cn(
          `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold
          transition`,
          isEditing
            ? `bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100
              dark:text-slate-900 dark:hover:bg-slate-200`
            : "bg-sky-500 text-white hover:bg-sky-600",
        )}
      >
        {isEditing ? (
          <>
            <X className="size-3.5" />
            Done
          </>
        ) : (
          <>
            <Pencil className="size-3.5" />
            Edit
          </>
        )}
      </button>
    </div>
  );
}
