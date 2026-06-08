"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { useScheduleSelection } from "./schedule-selection-provider";

type Props = {
  scheduleId: string;
  deleteSchedule: (scheduleId: string) => Promise<void>;
};

export function ScheduleDeleteButton({ scheduleId, deleteSchedule }: Props) {
  const { isEditing } = useScheduleSelection();
  const [isPending, startTransition] = useTransition();

  if (!isEditing) return null;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() =>
          deleteSchedule(scheduleId)
            .then(() => {
              triggerHaptic("success");
              toast.success("Schedule deleted");
            })
            .catch(() => {
              triggerHaptic("error");
              toast.error("Failed to delete schedule");
            }),
        )
      }
      className="flex items-center justify-center rounded-md border-2 border-red-700 bg-red-100 p-1 text-red-700 shadow-[1px_1px_0px_0px_#b91c1c] transition hover:bg-red-200 disabled:cursor-wait disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40"
      aria-label="Delete schedule"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
