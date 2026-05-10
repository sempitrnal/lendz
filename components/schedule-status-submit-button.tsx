"use client";

import { useFormStatus } from "react-dom";

type ScheduleStatusSubmitButtonProps = {
  status: string;
  isActive: boolean;
};

export default function ScheduleStatusSubmitButton({
  status,
  isActive,
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
      className={`rounded border px-2 py-1 text-xs font-semibold lowercase transition ${isActive
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-900 bg-white text-slate-900"
        } ${isDisabled ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-slate-100"}`}
    >
      {status}
    </button>
  );
}
