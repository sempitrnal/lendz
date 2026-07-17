"use client";

import { useScheduleSelection } from "./schedule-selection-provider";
import { ScheduleSelectAll } from "./schedule-select-all";
import { Pencil, X } from "lucide-react";

export function ScheduleEditBar({ allIds }: { allIds: string[] }) {
  const { isEditing, setIsEditing } = useScheduleSelection();

  return (
    <div
      className="flex items-center justify-between border-b border-slate-300
        bg-slate-50 px-4 py-2 print:hidden dark:border-border dark:bg-muted"
    >
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <ScheduleSelectAll allIds={allIds} />
            <span
              className="text-[10px] font-black uppercase tracking-wide
                text-slate-600 dark:text-muted-foreground"
            >
              Select all
            </span>
          </>
        ) : (
          <span
            className="text-[10px] font-black uppercase tracking-wide
              text-slate-400 dark:text-muted-foreground"
          >
            {allIds.length} schedule{allIds.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsEditing(!isEditing)}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1
          text-[10px] font-black uppercase tracking-wide transition
          active:translate-y-0 active:shadow-none dark:shadow-none ${
            isEditing
              ? `border-slate-300 bg-white text-slate-600 hover:border-slate-900
                hover:text-slate-600 dark:border-border dark:bg-card
                dark:text-muted-foreground dark:hover:text-foreground`
              : `border-slate-300 bg-sky-200 text-slate-600 hover:bg-sky-300
                dark:border-border dark:bg-sky-900/30 dark:text-sky-200
                dark:hover:bg-sky-900/40`
          }`}
      >
        {isEditing ? (
          <>
            <X className="size-3" />
            Done
          </>
        ) : (
          <>
            <Pencil className="size-3" />
            Edit
          </>
        )}
      </button>
    </div>
  );
}
