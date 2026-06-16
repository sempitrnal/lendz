import { isDarkColor } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import BorrowerDetailMenu from "./borrower-detail-menu";
import { BorrowerSummary } from "./borrower-detail-view";

export function StickyBorrowerStrip({
  borrower,
  totalLoaned,
  totalExpected,
  totalCollected,
  totalAmountCollected,
  totalRemaining,
  profitPerSchedule,
  collectedPct,
}: {
  borrower: BorrowerSummary | undefined;
  totalLoaned: number;
  totalExpected: number;
  totalCollected: number;
  totalAmountCollected: number;
  totalRemaining: number;
  profitPerSchedule: number;
  collectedPct: number;
}) {
  const [open, setOpen] = useState(false);
  if (!borrower) return null;
  return (
    <>
      <div
        className="bg-[#fefff3] border-b dark:bg-background sticky top-16 w-full
          max-w-[1500px] rounded right-0 left-0 z-30 sm:top-18 md:top-16
          md:left-(--sidebar-width)"
      >
        <div className="flex items-center justify-between px-4 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <p
                className="dark:text-foreground truncate text-sm font-black
                  tracking-wide text-slate-900 uppercase"
              >
                {borrower.first_name} {borrower.last_name}
              </p>
              {borrower.category && borrower.category.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1 mb-2">
                  {borrower.category.map((c) => (
                    <span
                      key={c.id}
                      className={`rounded border border-slate-900/30 px-1.5
                      py-0.5 text-[9px] font-black
                      ${isDarkColor(c.color) ? "text-white" : "text-slate-900"}`}
                      style={{ backgroundColor: c.color }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="dark:text-muted-foreground mt-0.5 flex flex-wrap
                  gap-x-3 gap-y-0.5 text-[11px] text-slate-500"
              >
                <span>
                  Loaned{" "}
                  <strong className="dark:text-foreground text-slate-700">
                    ₱{Math.round(totalLoaned).toLocaleString()}
                  </strong>
                </span>
                <span>
                  Collected{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    ₱{Math.round(totalAmountCollected).toLocaleString()}
                  </strong>
                </span>
                <span>
                  Remaining{" "}
                  <strong className="text-rose-700 dark:text-rose-400">
                    ₱{Math.round(totalRemaining).toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
            <ChevronDown
              className={`dark:text-muted-foreground ml-1 size-4 shrink-0
                text-slate-500 transition-transform duration-200
                ${open ? "rotate-180" : ""}`}
            />
          </button>
          <div className="ml-2 shrink-0" data-prevent-strip-open>
            <BorrowerDetailMenu borrowerId={borrower.id} />
          </div>
        </div>
        <div
          className={`bg-background absolute top-[80px] right-0 left-0 z-30
            overflow-hidden border-x-2 border-b-2 border-slate-900
            shadow-[0_4px_0px_0px_#0f172a] backdrop-blur transition-all
            duration-300 ease-out dark:border-[#020617]
            dark:shadow-[0_4px_0px_0px_#020617]
            ${open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pt-2 pb-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {(
                [
                  {
                    label: "Total Loaned",
                    value: totalLoaned,
                    bg: "bg-sky-100 dark:bg-sky-900/30",
                  },
                  {
                    label: "Money Collected",
                    value: totalAmountCollected,
                    bg: "bg-teal-100 dark:bg-teal-900/30",
                  },
                  {
                    label: "Remaining",
                    value: totalRemaining,
                    bg: "bg-rose-100 dark:bg-rose-900/30",
                  },
                  {
                    label: "Profit Expected",
                    value: totalExpected,
                    bg: "bg-amber-100 dark:bg-amber-900/30",
                  },
                  {
                    label: "Profit Collected",
                    value: totalCollected,
                    bg: "bg-emerald-100 dark:bg-emerald-900/30",
                  },
                  {
                    label: "Profit / Schedule",
                    value: profitPerSchedule,
                    bg: "bg-violet-100 dark:bg-violet-900/50",
                  },
                ] as const
              ).map(({ label, value, bg }) => (
                <div
                  key={label}
                  className={`border-2 border-slate-900 ${bg} px-2 py-1.5
                  shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617]`}
                >
                  <p
                    className="dark:text-muted-foreground font-black
                      tracking-wide text-slate-500 uppercase"
                  >
                    {label}
                  </p>
                  <p
                    className="dark:text-[#c2c2c2] mt-0.5 text-xl md:text-3xl
                      font-bold text-[#593b5e] tabular-nums"
                  >
                    ₱{Math.round(value).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-2 flex-1 overflow-hidden rounded-sm border-2
                  border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]
                  dark:border-[#020617] dark:bg-slate-900"
              >
                <div
                  className="h-full bg-emerald-400 transition-[width]
                    duration-500 ease-out dark:bg-emerald-500"
                  style={{ width: open ? `${collectedPct}%` : "0%" }}
                />
              </div>
              <span
                className="dark:text-foreground shrink-0 text-[10px] font-black
                  text-slate-700 tabular-nums"
              >
                {collectedPct}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
