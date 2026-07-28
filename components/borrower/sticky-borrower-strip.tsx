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
        className="sticky top-16 z-40 border-b border-slate-300/60 bg-white
          dark:bg-background backdrop-blur-md dark:border-slate-700/60 sm:top-16
          md:top-16"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center justify-between
              transition-colors duration-200 hover:bg-slate-50/50
              dark:hover:bg-slate-800/30"
          >
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p
                  className="truncate text-lg font-black tracking-tight
                    text-slate-700 dark:text-foreground"
                >
                  {borrower.first_name} {borrower.last_name}
                </p>
              </div>
              {borrower.category && borrower.category.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {borrower.category.map((c) => (
                    <span
                      key={c.id}
                      className={`rounded-sm px-2 py-0.5 text-[10px]
                      font-semibold
                      ${isDarkColor(c.color) ? "text-white" : "text-slate-700"}`}
                      style={{
                        backgroundColor: c.color ? `${c.color}` : "#cbd5e120",
                        border: `1px solid ${c.color ? `${c.color}40` : "#cbd5e140"}`,
                      }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[14px]
                  text-slate-400 dark:text-muted-foreground"
              >
                <span>
                  Loaned{" "}
                  <strong
                    className="font-semibold text-slate-600
                      dark:text-foreground/80"
                  >
                    ₱{Math.round(totalLoaned).toLocaleString()}
                  </strong>
                </span>
                <span>
                  Collected{" "}
                  <strong
                    className="font-semibold text-[#5f956a] dark:text-[#7bc48a]"
                  >
                    ₱{Math.round(totalAmountCollected).toLocaleString()}
                  </strong>
                </span>
                <span>
                  Remaining{" "}
                  <strong
                    className="font-semibold text-[#c45b5b] dark:text-[#dc7676]"
                  >
                    ₱{Math.round(totalRemaining).toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
            <ChevronDown
              className={`ml-2 size-4 shrink-0 text-slate-400
                transition-transform duration-200 dark:text-muted-foreground
                ${open ? "rotate-180" : ""}`}
            />
          </button>
          <div className="ml-2 shrink-0" data-prevent-strip-open>
            <BorrowerDetailMenu
              borrowerId={borrower.id}
              editBorrower={{
                initial: {
                  first_name: borrower.first_name,
                  last_name: borrower.last_name,
                  contact: borrower.contact,
                },
                initialCategoryIds: borrower.category?.map((c) => c.id) ?? [],
              }}
            />
          </div>
        </div>

        {/* Dropdown overlay */}
        <div
          className={`absolute top-full right-0 left-0 z-30 overflow-hidden
            border-x border-b border-slate-300/60 bg-white dark:bg-background
            backdrop-blur-md transition-all duration-300 ease-out
            dark:border-slate-700/60
            ${open ? "max-h-[440px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-3">
              {[
                {
                  label: "Total Loaned",
                  value: totalLoaned,
                  tint: "bg-sky-50 dark:bg-sky-900/20",
                  text: "text-sky-700 dark:text-sky-300",
                },
                {
                  label: "Collected",
                  value: totalAmountCollected,
                  tint: "bg-emerald-50 dark:bg-emerald-900/20",
                  text: "text-emerald-700 dark:text-emerald-300",
                },
                {
                  label: "Remaining",
                  value: totalRemaining,
                  tint: "bg-rose-50 dark:bg-rose-900/20",
                  text: "text-rose-700 dark:text-rose-300",
                },
                {
                  label: "Profit Expected",
                  value: Math.max(0, totalExpected),
                  tint: "bg-amber-50 dark:bg-amber-900/20",
                  text: "text-amber-700 dark:text-amber-300",
                },
                {
                  label: "Profit Collected",
                  value: Math.max(0, totalCollected),
                  tint: "bg-teal-50 dark:bg-teal-900/20",
                  text: "text-teal-700 dark:text-teal-300",
                },
                {
                  label: "Profit / schedule",
                  value: profitPerSchedule,
                  tint: "bg-violet-50 dark:bg-violet-900/20",
                  text: "text-[#351953] dark:text-violet-300",
                },
              ].map(({ label, value, tint, text }) => (
                <div
                  key={label}
                  className={`rounded-xl border border-slate-300/60 ${tint} px-3
                  py-2 dark:border-slate-700/60`}
                >
                  <p
                    className={`text-[14px] font-bold lowercase tracking-tight
                    ${text}`}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-0.5 text-lg font-black tracking-tight
                      tabular-nums text-slate-600 dark:text-foreground"
                  >
                    ₱{Math.round(value).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full border
                  border-slate-300/60 bg-slate-100 dark:border-slate-700/60
                  dark:bg-slate-800"
              >
                <div
                  className="h-full rounded-full bg-emerald-400
                    transition-[width] duration-500 ease-out
                    dark:bg-emerald-500"
                  style={{ width: open ? `${collectedPct}%` : "0%" }}
                />
              </div>
              <span
                className="text-sm font-bold tabular-nums text-slate-600
                  dark:text-foreground"
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
