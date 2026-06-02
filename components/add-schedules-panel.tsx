"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type Row = { due_date: string; amount_due: string; note: string };

const EMPTY_ROW = (): Row => ({ due_date: "", amount_due: "", note: "" });

function formatCommas(value: string): string {
  const digits = value.replace(/[^0-9.]/g, "");
  const [int, dec] = digits.split(".");
  const formatted = (int ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${formatted}.${dec}` : formatted;
}

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateDates(
  startDate: string,
  pattern: "15_30" | "monthly" | "weekly",
  count: number,
): string[] {
  if (!startDate || count < 1) return [];
  const dates: string[] = [];
  const [y, m, d] = startDate.split("-").map(Number);

  if (pattern === "15_30") {
    let year = y!;
    let month = m!;
    const anchorDay = d!;
    const isFirst = anchorDay <= 15;
    let useFirst = isFirst;

    for (let i = 0; i < count; i++) {
      const day = useFirst ? 15 : 30;
      const lastDay = new Date(year, month, 0).getDate();
      dates.push(
        formatLocalDate(new Date(year, month - 1, Math.min(day, lastDay))),
      );
      if (!useFirst) {
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
      useFirst = !useFirst;
    }
  } else if (pattern === "monthly") {
    let year = y!;
    let month = m!;
    const day = d!;
    for (let i = 0; i < count; i++) {
      const lastDay = new Date(year, month, 0).getDate();
      dates.push(
        formatLocalDate(new Date(year, month - 1, Math.min(day, lastDay))),
      );
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  } else {
    let current = new Date(y!, (m ?? 1) - 1, d ?? 1);
    for (let i = 0; i < count; i++) {
      dates.push(formatLocalDate(current));
      current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  return dates;
}

type Props = {
  accountId: string;
  addSchedules: (
    rows: { due_date: string; amount_due: number; note?: string }[],
  ) => Promise<{ error?: string }>;
};

export default function AddSchedulesPanel({ accountId, addSchedules }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([EMPTY_ROW()]);
  const [isPending, startTransition] = useTransition();

  const [batchStart, setBatchStart] = useState("");
  const [batchAmount, setBatchAmount] = useState("");
  const [batchPattern, setBatchPattern] = useState<
    "15_30" | "monthly" | "weekly"
  >("15_30");
  const [batchCount, setBatchCount] = useState("6");

  function updateRow(i: number, field: keyof Row, value: string) {
    const formatted = field === "amount_due" ? formatCommas(value) : value;
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: formatted } : r)),
    );
  }

  function addRow() {
    const last = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      { due_date: "", amount_due: last?.amount_due ?? "", note: "" },
    ]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleGenerate() {
    const dates = generateDates(batchStart, batchPattern, Number(batchCount));
    if (!dates.length) {
      toast.error("Invalid start date or count");
      return;
    }
    setRows(
      dates.map((due_date) => ({
        due_date,
        amount_due: formatCommas(batchAmount),
        note: "",
      })),
    );
  }

  function handleSubmit() {
    const valid = rows.filter(
      (r) => r.due_date && r.amount_due && parseAmount(r.amount_due) > 0,
    );
    if (!valid.length) {
      toast.error("Add at least one row with a date and amount");
      return;
    }

    startTransition(async () => {
      const result = await addSchedules(
        valid.map((r) => ({
          due_date: r.due_date,
          amount_due: parseAmount(r.amount_due),
          note: r.note || undefined,
        })),
      );
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `${valid.length} schedule${valid.length === 1 ? "" : "s"} added.`,
        );
        setRows([EMPTY_ROW()]);
        setOpen(false);
      }
    });
  }

  return (
    <div className="border-t-2 border-slate-900 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-black tracking-wide text-slate-800 uppercase transition-colors hover:bg-slate-50 sm:px-5 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <span className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded border-2 border-slate-900 bg-lime-300 text-xs font-black shadow-[1px_1px_0px_0px_#0f172a] dark:border-zinc-700 dark:bg-lime-400 dark:shadow-none">
            {open ? "−" : "+"}
          </span>
          Add schedules
        </span>
        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase dark:text-zinc-500">
          {open ? "close" : "expand"}
        </span>
      </button>

      {open && (
        <div className="border-t-2 border-dashed border-slate-200 px-4 pt-4 pb-5 sm:px-5 dark:border-zinc-700">
          {/* — Quick batch generator — */}
          <div className="mb-4 rounded-xl border-2 border-slate-900 bg-amber-50 p-4 shadow-[3px_3px_0px_0px_#0f172a] dark:border-zinc-700 dark:bg-zinc-800/50 dark:shadow-[3px_3px_0px_0px_#18181b]">
            <p className="mb-3 text-[10px] font-black tracking-widest text-slate-600 uppercase dark:text-zinc-400">
              Quick batch generator
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-black tracking-wide text-slate-500 uppercase dark:text-zinc-400">
                  Start date
                </label>
                <input
                  type="date"
                  value={batchStart}
                  onChange={(e) => setBatchStart(e.target.value)}
                  className="w-full min-w-0 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-semibold shadow-[2px_2px_0px_0px_#0f172a] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[2px_2px_0px_0px_#18181b]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black tracking-wide text-slate-500 uppercase dark:text-zinc-400">
                  Amount per schedule
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 5,000"
                  value={batchAmount}
                  onChange={(e) => setBatchAmount(formatCommas(e.target.value))}
                  className="w-full rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-semibold tabular-nums shadow-[2px_2px_0px_0px_#0f172a] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[2px_2px_0px_0px_#18181b]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black tracking-wide text-slate-500 uppercase dark:text-zinc-400">
                  Pattern
                </label>
                <select
                  value={batchPattern}
                  onChange={(e) =>
                    setBatchPattern(e.target.value as typeof batchPattern)
                  }
                  className="w-full rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-semibold shadow-[2px_2px_0px_0px_#0f172a] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[2px_2px_0px_0px_#18181b]"
                >
                  <option value="15_30">15th &amp; 30th</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black tracking-wide text-slate-500 uppercase dark:text-zinc-400">
                  Count
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={batchCount}
                    onChange={(e) => setBatchCount(e.target.value)}
                    className="w-full rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-semibold shadow-[2px_2px_0px_0px_#0f172a] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[2px_2px_0px_0px_#18181b]"
                  />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="shrink-0 rounded-lg border-2 border-slate-900 bg-lime-300 px-3 py-2 text-xs font-black tracking-wide text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none dark:border-zinc-700 dark:bg-lime-400 dark:shadow-[2px_2px_0px_0px_#18181b]"
                  >
                    Fill
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* — Row editor — */}
          <div className="overflow-x-auto rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] dark:border-zinc-700 dark:shadow-[3px_3px_0px_0px_#18181b]">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <th className="border-r-2 border-slate-900 px-3 py-2.5 text-left text-[10px] font-black tracking-wide text-slate-700 uppercase dark:border-zinc-700 dark:text-zinc-300">
                    #
                  </th>
                  <th className="border-r-2 border-slate-900 px-3 py-2.5 text-left text-[10px] font-black tracking-wide text-slate-700 uppercase dark:border-zinc-700 dark:text-zinc-300">
                    Due date
                  </th>
                  <th className="border-r-2 border-slate-900 px-3 py-2.5 text-left text-[10px] font-black tracking-wide text-slate-700 uppercase dark:border-zinc-700 dark:text-zinc-300">
                    Amount due (₱)
                  </th>
                  <th className="border-r-2 border-slate-900 px-3 py-2.5 text-left text-[10px] font-black tracking-wide text-slate-700 uppercase dark:border-zinc-700 dark:text-zinc-300">
                    Note
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b-2 border-slate-900 last:border-b-0 odd:bg-white even:bg-slate-50/60 dark:border-zinc-700 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/30"
                  >
                    <td className="border-r-2 border-slate-900 px-3 py-2 text-center text-xs font-black text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
                      {i + 1}
                    </td>
                    <td className="border-r-2 border-slate-900 px-2 py-1.5">
                      <input
                        type="date"
                        value={row.due_date}
                        onChange={(e) =>
                          updateRow(i, "due_date", e.target.value)
                        }
                        className="w-full min-w-0 rounded-md border-2 border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500"
                      />
                    </td>
                    <td className="border-r-2 border-slate-900 px-2 py-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={row.amount_due}
                        onChange={(e) =>
                          updateRow(i, "amount_due", e.target.value)
                        }
                        className="w-full rounded-md border-2 border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500"
                      />
                    </td>
                    <td className="border-r-2 border-slate-900 px-2 py-1.5">
                      <input
                        type="text"
                        placeholder="optional"
                        value={row.note}
                        onChange={(e) => updateRow(i, "note", e.target.value)}
                        className="w-full rounded-md border-2 border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="rounded-md border-2 border-slate-900 bg-rose-100 px-2 py-1 text-xs font-black text-rose-700 shadow-[1px_1px_0px_0px_#0f172a] transition-all hover:bg-rose-200 active:shadow-none dark:border-zinc-700 dark:bg-rose-900/30 dark:text-rose-300 dark:shadow-[1px_1px_0px_0px_#18181b] dark:hover:bg-rose-900/50"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* — Actions — */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-xs font-black tracking-wide uppercase shadow-[2px_2px_0px_0px_#0f172a] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[2px_2px_0px_0px_#18181b]"
            >
              <span className="text-base leading-none">+</span> Add row
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {rows.filter((r) => r.due_date && r.amount_due).length} of{" "}
                {rows.length} ready
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="rounded-lg border-2 border-slate-900 bg-lime-300 px-5 py-2 text-sm font-black tracking-wide text-slate-900 uppercase shadow-[3px_3px_0px_0px_#0f172a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#0f172a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60 dark:border-zinc-700 dark:bg-lime-400 dark:shadow-[3px_3px_0px_0px_#18181b] dark:hover:shadow-[2px_2px_0px_0px_#18181b]"
              >
                {isPending ? "Saving…" : "Save schedules"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
