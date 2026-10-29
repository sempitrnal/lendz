"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarPlus, ChevronDown, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { todayDateValue } from "@/lib/checklist/dates";

type Row = { due_date: string; amount_due: string; note: string };

const EMPTY_ROW = (): Row => ({ due_date: "", amount_due: "", note: "" });
/** The row the card starts with (and goes back to): due today. */
const FIRST_ROW = (): Row => ({ ...EMPTY_ROW(), due_date: todayDateValue() });

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

type Pattern = "15_30" | "monthly" | "weekly";

const PATTERNS: { id: Pattern; label: string }[] = [
  { id: "15_30", label: "15th & 30th" },
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
];

// 16px on a phone, or iOS zooms the page when a field takes focus.
const FIELD = `h-10 w-full min-w-0 rounded-xl border-0 bg-muted px-3 text-base
  font-semibold text-foreground outline-none placeholder:font-normal
  placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-emerald-500/60
  sm:text-sm`;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-1 block text-[11px] font-bold text-muted-foreground
        lowercase"
    >
      {children}
    </span>
  );
}

/**
 * Adds schedules to a manual account: a card that opens in place. A quick
 * fill lays out a run of dates (15th & 30th, monthly, weekly) with one
 * amount; the rows under it are what gets saved, each one editable. Rows
 * stack as small blocks (date and amount side by side, the note under them)
 * so it fits a phone, and Save says how many are ready and for how much.
 */
export default function AddSchedulesPanel({ addSchedules }: Props) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<Row[]>(() => [FIRST_ROW()]);
  const [isPending, startTransition] = useTransition();

  const [batchStart, setBatchStart] = useState("");
  const [batchAmount, setBatchAmount] = useState("");
  const [batchPattern, setBatchPattern] = useState<Pattern>("15_30");
  const [batchCount, setBatchCount] = useState("6");
  // Quick fill and notes stay out of the way until asked for.
  const [showFill, setShowFill] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  /** Opening brings the whole card up above the bottom nav, once it has grown. */
  function toggle() {
    if (!open) {
      setTimeout(
        () =>
          card.current?.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "end",
          }),
        reduceMotion ? 0 : 320,
      );
    }
    setOpen((o) => !o);
  }

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
    setRows((prev) =>
      prev.length === 1 ? [FIRST_ROW()] : prev.filter((_, idx) => idx !== i),
    );
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
    setShowFill(false);
  }

  const ready = rows.filter(
    (r) => r.due_date && r.amount_due && parseAmount(r.amount_due) > 0,
  );
  const readyTotal = ready.reduce((n, r) => n + parseAmount(r.amount_due), 0);

  function handleSubmit() {
    if (!ready.length) {
      triggerHaptic("warning");
      toast.error("Add at least one row with a date and amount");
      return;
    }

    startTransition(async () => {
      const result = await addSchedules(
        ready.map((r) => ({
          due_date: r.due_date,
          amount_due: parseAmount(r.amount_due),
          note: r.note || undefined,
        })),
      );
      if (result?.error) {
        triggerHaptic("error");
        toast.error(result.error);
      } else {
        triggerHaptic("success");
        toast.success(
          `${ready.length} schedule${ready.length === 1 ? "" : "s"} added.`,
        );
        setRows([FIRST_ROW()]);
        setShowFill(false);
        setShowNotes(false);
        setOpen(false);
      }
    });
  }

  const link =
    "text-xs font-bold text-emerald-700 active:opacity-60 dark:text-emerald-300";

  return (
    <div
      ref={card}
      className="scroll-mb-28 overflow-hidden rounded-2xl bg-card shadow-sm
        ring-1 ring-black/5 dark:ring-white/10"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center
            rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20
            dark:text-emerald-300"
        >
          <CalendarPlus className="size-5" aria-hidden="true" />
        </span>
        <span
          className="min-w-0 flex-1 text-sm font-black text-card-foreground/80"
        >
          Add schedules
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="body"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t px-4 pt-4 pb-4">
              {/* Quick fill folds away instead of unmounting, so what was typed in
              it is still there when it opens again. */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  showFill ? "grid-rows-[1fr]" : "-mb-3 grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden" inert={!showFill}>
                  <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
                    <div
                      role="radiogroup"
                      aria-label="Pattern"
                      className="flex gap-1 rounded-2xl bg-muted p-1"
                    >
                      {PATTERNS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={batchPattern === p.id}
                          onClick={() => setBatchPattern(p.id)}
                          className={cn(
                            "flex-1 rounded-xl py-1.5 text-xs font-semibold",
                            batchPattern === p.id
                              ? `bg-card text-emerald-600 shadow-sm
                                dark:text-emerald-300`
                              : "text-muted-foreground",
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <Label>first date</Label>
                        <input
                          type="date"
                          value={batchStart}
                          onChange={(e) => setBatchStart(e.target.value)}
                          className={cn(FIELD, "bg-card")}
                        />
                      </label>
                      <label>
                        <Label>amount each</Label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="5,000"
                          value={batchAmount}
                          onChange={(e) =>
                            setBatchAmount(formatCommas(e.target.value))
                          }
                          className={cn(FIELD, "bg-card tabular-nums")}
                        />
                      </label>
                    </div>
                    <div className="flex items-end gap-3">
                      <label className="w-24">
                        <Label>how many</Label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={120}
                          value={batchCount}
                          onChange={(e) => setBatchCount(e.target.value)}
                          className={cn(FIELD, "bg-card")}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="h-10 flex-1 rounded-xl bg-emerald-100 text-sm
                          font-bold text-emerald-700 active:bg-emerald-200
                          dark:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        Fill rows
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <ol className="space-y-2">
                {rows.map((row, i) => (
                  <li key={i}>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        aria-label={`Schedule ${i + 1} due date`}
                        value={row.due_date}
                        onChange={(e) =>
                          updateRow(i, "due_date", e.target.value)
                        }
                        className={cn(FIELD, "w-auto flex-[2.2] px-2")}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="₱0"
                        aria-label={`Schedule ${i + 1} amount`}
                        value={row.amount_due}
                        onChange={(e) =>
                          updateRow(i, "amount_due", e.target.value)
                        }
                        className={cn(FIELD, "w-auto flex-1 tabular-nums")}
                      />
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          aria-label={`Remove schedule ${i + 1}`}
                          className="flex size-8 shrink-0 items-center
                            justify-center rounded-full text-muted-foreground
                            active:bg-rose-100 active:text-rose-600"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    {(showNotes || row.note) && (
                      <input
                        type="text"
                        placeholder="note"
                        aria-label={`Schedule ${i + 1} note`}
                        value={row.note}
                        onChange={(e) => updateRow(i, "note", e.target.value)}
                        className={cn(FIELD, "mt-2 h-9 font-normal")}
                      />
                    )}
                  </li>
                ))}
              </ol>

              <div className="flex items-center gap-4 px-1">
                <button type="button" onClick={addRow} className={link}>
                  + another
                </button>
                <button
                  type="button"
                  onClick={() => setShowFill((v) => !v)}
                  aria-expanded={showFill}
                  className={link}
                >
                  {showFill ? "hide quick fill" : "fill a run of dates"}
                </button>
                {!showNotes && (
                  <button
                    type="button"
                    onClick={() => setShowNotes(true)}
                    className={link}
                  >
                    notes
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || ready.length === 0}
                className="flex h-12 w-full items-center justify-center
                  rounded-2xl bg-emerald-600 text-sm font-bold text-white
                  transition-opacity disabled:opacity-50 dark:bg-emerald-700"
              >
                {isPending
                  ? "Saving…"
                  : ready.length === 0
                    ? "Save"
                    : `Save ${ready.length} · ₱${readyTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
