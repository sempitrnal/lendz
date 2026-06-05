import Link from "next/link";
import { CalendarDays, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getCalendarEventsByBorrower } from "@/lib/cache/calendar-events";

export default async function BorrowerCalendarEvents({
  borrowerId,
}: {
  borrowerId: string;
}) {
  const events = await getCalendarEventsByBorrower(borrowerId);
  const upcoming = events.filter((e) => e.status !== "cancelled");

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-slate-900 bg-white shadow-[4px_4px_0px_0px_#0f172a]">
      <div className="flex items-center gap-2 border-b-2 border-slate-900 bg-green-300 px-4 py-3">
        <CalendarDays className="size-5 text-slate-900" />
        <h2 className="text-sm font-black tracking-wide text-slate-900 uppercase">
          scheduled
        </h2>
      </div>
      <div className="flex flex-col">
        {upcoming.map((evt) => {
          const date = new Date(evt.event_date);
          const isPast = date < new Date();
          const account = evt.account;
          return (
            <Link
              key={evt.id}
              href={`/calendar`}
              className={`flex items-center justify-between border-b border-slate-200 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-50 ${
                isPast ? "opacity-70" : ""
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-500">
                  {formatDate(evt.event_date)}
                  {isPast ? " (past)" : ""}
                </span>
                <span className="text-sm font-black text-slate-900">
                  {evt.title || "Scheduled visit"}
                </span>
                {evt.amount > 0 ? (
                  <span className="text-xs text-slate-500">
                    ₱{evt.amount.toLocaleString()}
                  </span>
                ) : account ? (
                  <span className="text-xs text-slate-500">
                    ₱{Number(account.principal_amount ?? 0).toLocaleString()} —{" "}
                    {account.status}
                  </span>
                ) : null}
                {evt.note ? (
                  <span className="text-xs text-slate-500">{evt.note}</span>
                ) : null}
              </div>
              <ArrowRight className="size-4 shrink-0 text-slate-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
