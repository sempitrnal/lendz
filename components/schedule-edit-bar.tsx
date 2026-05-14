"use client";

import { useScheduleSelection } from "./schedule-selection-provider";
import { ScheduleSelectAll } from "./schedule-select-all";
import { Pencil, X } from "lucide-react";

export function ScheduleEditBar({ allIds }: { allIds: string[] }) {
  const { isEditing, setIsEditing } = useScheduleSelection();

  return (
    <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-50 px-4 py-2 print:hidden">
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <ScheduleSelectAll allIds={allIds} />
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">
              Select all
            </span>
          </>
        ) : (
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            {allIds.length} schedule{allIds.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsEditing(!isEditing)}
        className={`flex items-center gap-1.5 rounded-md border-2 px-2 py-1 text-[10px] font-black uppercase tracking-wide shadow-[2px_2px_0px_0px_#0f172a] transition active:translate-y-0 active:shadow-none ${
          isEditing
            ? "border-slate-300 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900"
            : "border-slate-900 bg-sky-200 text-slate-900 hover:bg-sky-300"
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
