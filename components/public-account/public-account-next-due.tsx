import { CalendarClock } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Props = {
  amount: number;
  dueDate: string;
};

export default function PublicAccountNextDue({ amount, dueDate }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-sky-500/50
        bg-sky-50 p-5 dark:border-sky-500/50 dark:bg-sky-900/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-widest
              text-sky-700 dark:text-sky-300"
          >
            Next Payment Due
          </p>
          <p
            className="mt-1 text-2xl font-black text-sky-900
              dark:text-sky-100"
          >
            {formatMoney(amount)}
          </p>
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
            {dueDate}
          </p>
        </div>
        <div
          className="flex size-10 shrink-0 items-center justify-center
            rounded-full bg-sky-100 text-sky-700 dark:bg-sky-800
            dark:text-sky-300"
        >
          <CalendarClock className="size-5" />
        </div>
      </div>
    </div>
  );
}
