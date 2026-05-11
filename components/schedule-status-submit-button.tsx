"use client";

import { useFormStatus } from "react-dom";

type ScheduleStatusSubmitButtonProps = {
  status: string;
  isActive: boolean;
  className?: string;
};

export default function ScheduleStatusSubmitButton({
  status,
  isActive,
  className,
}: ScheduleStatusSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = isActive || pending;

  return (
    <button
      type="submit"
      name="status"
      value={status}
      disabled={isDisabled}
      aria-busy={pending}
      aria-pressed={isActive}
      className={`min-h-9 min-w-17 px-2.5 py-1.5 text-xs font-semibold capitalize tracking-wide transition ${isActive
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        } ${isDisabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"} ${className ?? ""}`}
    >
      {status}
    </button>
  );
}
