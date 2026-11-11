"use client";

/**
 * THROWAWAY PROTOTYPE: checklist redesign mockup.
 * Fake data, nothing is saved or sent. Design: quick-pay list, swipe left for
 * partial / note, "Pay 2" sheet for borrowers with several installments, and a
 * Release tab that turns a released loan into an account.
 */

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, useAnimationControls } from "motion/react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudUpload,
  ExternalLink,
  HandCoins,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formFieldErrorClassName,
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { buildSchedulesPayload } from "@/lib/payment-schedule/build-payload";
import { parseReleasedLabel } from "@/lib/checklist/released";
import { deriveBimonthlyAnchors } from "@/lib/payment-schedule/bimonthly-legacy";
import { formatDate, formatMoney } from "@/lib/utils";

// ---------- fake data ----------

type Kind = "loan" | "ca";
type Inst = {
  id: string;
  kind: Kind;
  due: string;
  /** ISO date of `due`, so lateness can be worked out for any day. */
  iso: string;
  daysLate: number;
  amount: number;
  paid: number;
  /** A payment recorded on a manual-schedule account (not an installment). */
  manual?: boolean;
};
type Row = {
  id: string;
  name: string;
  group: string;
  insts: Inst[];
  note?: string;
};
type Release = {
  id: string;
  name: string;
  amount: number;
  kind: Kind;
  term: number;
  typed: string;
  /** First payment date read from the note ("for 110426"), if it had one. */
  first?: string;
  created: boolean;
};

const GROUPS: Record<string, { name: string; color: string }> = {
  topserve: { name: "topserve (4th & 19th)", color: "#22c55e" },
  rose: { name: "rose pharmacy (8th & 23rd)", color: "#22d3ee" },
  fifteenth: { name: "15th and 30th", color: "#c026d3" },
  chowking: { name: "chowking (15/30)", color: "#eab308" },
};

/** The demo's "now": the checklist opens on this day. */
const TODAY_ISO = "2026-10-19";
const MONTH_NUM: Record<string, string> = { oct: "10", nov: "11", dec: "12" };
const isoFromLabel = (due: string) => {
  const [mon, day] = due.split(" ");
  return `2026-${MONTH_NUM[mon] ?? "10"}-${day.padStart(2, "0")}`;
};

const DAY_MS = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const shiftIso = (iso: string, n: number) =>
  new Date(toMs(iso) + n * DAY_MS).toISOString().slice(0, 10);
const diffDays = (from: string, to: string) =>
  Math.round((toMs(to) - toMs(from)) / DAY_MS);
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const relativeLabel = (iso: string) =>
  ({ "-1": "yesterday", "0": "today", "1": "tomorrow" })[
    String(diffDays(TODAY_ISO, iso)) as "-1" | "0" | "1"
  ] ?? null;

const inst = (
  id: string,
  kind: Kind,
  due: string,
  daysLate: number,
  amount: number,
  paid = 0,
): Inst => ({ id, kind, due, iso: isoFromLabel(due), daysLate, amount, paid });

const INITIAL_ROWS: Row[] = [
  {
    id: "r1",
    name: "Ana Reyes",
    group: "topserve",
    insts: [inst("i1", "loan", "oct 19", 0, 1850)],
  },
  {
    id: "r2",
    name: "Marites Dizon",
    group: "topserve",
    insts: [
      inst("i2a", "loan", "oct 19", 0, 1233.33),
      inst("i2b", "ca", "oct 19", 0, 1400),
    ],
  },
  {
    id: "r3",
    name: "Rhea Salvador",
    group: "topserve",
    insts: [inst("i3", "ca", "oct 19", 0, 1060)],
  },
  {
    id: "r4",
    name: "Joy Dela Cruz",
    group: "topserve",
    insts: [inst("i4", "loan", "oct 19", 0, 600, 600)],
  },
  {
    id: "c1",
    name: "Lita Gomez",
    group: "fifteenth",
    insts: [
      inst("c1a", "ca", "oct 15", 4, 742.5),
      inst("c1b", "loan", "oct 15", 4, 2616.67),
    ],
  },
  {
    id: "c2",
    name: "Mario Cruz",
    group: "fifteenth",
    insts: [inst("c2a", "loan", "oct 15", 4, 4083.33)],
  },
  {
    id: "c3",
    name: "Rosa Lim",
    group: "fifteenth",
    insts: [inst("c3a", "loan", "oct 15", 4, 1541.67)],
  },
  {
    id: "c4",
    name: "Ben Torres",
    group: "fifteenth",
    insts: [inst("c4a", "loan", "oct 15", 4, 900, 400)],
  },
  {
    id: "c5",
    name: "Jun Navarro",
    group: "rose",
    insts: [inst("c5a", "ca", "oct 12", 7, 578.57)],
  },
  {
    id: "c6",
    name: "Gina Ocampo",
    group: "rose",
    insts: [inst("c6a", "loan", "oct 15", 4, 500)],
  },
  {
    id: "c7",
    name: "Pedro Salas",
    group: "chowking",
    insts: [inst("c7a", "loan", "oct 15", 4, 3812.2)],
  },
  {
    id: "c8",
    name: "Edna Flores",
    group: "chowking",
    insts: [inst("c8a", "loan", "oct 15", 4, 401.32, 325)],
  },
  {
    id: "c9",
    name: "Dante Uy",
    group: "chowking",
    insts: [
      inst("c9a", "loan", "oct 5", 14, 1500),
      inst("c9b", "loan", "oct 15", 4, 1500),
    ],
  },
];

const INITIAL_RELEASES: Release[] = [
  {
    id: "x1",
    name: "Carla Mendoza",
    amount: 10000,
    kind: "loan",
    term: 10,
    typed: "carla mendoza 10,000 - 10 months for 110426",
    first: "2026-11-04",
    created: false,
  },
  {
    id: "x2",
    name: "Efren Tan",
    amount: 5000,
    kind: "loan",
    term: 6,
    typed: "efren tan 5,000 (6) months",
    created: false,
  },
  {
    id: "x3",
    name: "Joy Dela Cruz",
    amount: 1000,
    kind: "ca",
    term: 1,
    typed: "joy dela cruz 1,000- c.a. for 102926",
    first: "2026-10-29",
    created: true,
  },
];

const NAMES = INITIAL_ROWS.map((r) => r.name);

/** Due today or running late but not on the starting list: what "Populate due" adds. */
const EXTRA_DUE: Row[] = [
  {
    id: "p1",
    name: "Tess Mercado",
    group: "topserve",
    insts: [inst("p1a", "loan", "oct 19", 0, 980)],
  },
  {
    id: "p2",
    name: "Carlo Estrada",
    group: "chowking",
    insts: [inst("p2a", "loan", "oct 15", 4, 1750)],
  },
];
/** Everyone the server would return for today plus the 7-day look-back. */
const DUE_POOL: Row[] = [...INITIAL_ROWS, ...EXTRA_DUE];
const EMPTY_ROWS: Row[] = [];
const EMPTY_RELEASES: Release[] = [];

/** What "Populate due" would find for a day: unpaid installments due that day or in the 7 days before. */
function poolFor(date: string): Row[] {
  const from = shiftIso(date, -7);
  return DUE_POOL.flatMap((r) => {
    const insts = r.insts
      .filter((i) => left(i) > 0 && i.iso <= date && i.iso >= from)
      .map((i) => ({
        ...i,
        amount: left(i),
        paid: 0,
        daysLate: Math.max(0, diffDays(i.iso, date)),
      }));
    return insts.length ? [{ ...r, id: `${r.id}@${date}`, insts }] : [];
  });
}

// ---------- helpers ----------

const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const left = (i: Inst) => Math.max(0, round2(i.amount - i.paid));
const rowLeft = (r: Row) => round2(r.insts.reduce((s, i) => s + left(i), 0));
const settled = (r: Row) => rowLeft(r) < 0.005;
const isCarried = (r: Row) => r.insts.every((i) => i.daysLate > 0);
const openInsts = (r: Row) => r.insts.filter((i) => left(i) > 0);
const rowLate = (r: Row) => Math.max(0, ...openInsts(r).map((i) => i.daysLate));
const kindLabel = (k: Kind) => (k === "ca" ? "cash advance" : "loan");

function subline(row: Row): { text: string; late: boolean } {
  const open = openInsts(row);
  if (open.length === 0) return { text: "paid · tap to edit", late: false };
  if (open.length > 1) {
    const worst = rowLate(row);
    return {
      text: `${open.length} due${worst > 0 ? ` · oldest ${worst}d late` : ""}`,
      late: worst > 0,
    };
  }
  const i = open[0];
  const paid = i.paid > 0 ? `${peso(i.paid)} paid · ` : "";
  return {
    text:
      i.daysLate > 0
        ? `${paid}${i.due} · ${i.daysLate}d late · ${kindLabel(i.kind)}`
        : `${paid}${i.due} · ${kindLabel(i.kind)}`,
    late: i.daysLate > 0,
  };
}

type Filter = "all" | "overdue" | "today" | "paid";

function matches(row: Row, f: Filter) {
  if (f === "all") return true;
  if (f === "paid") return settled(row);
  if (settled(row)) return false;
  if (f === "overdue") return rowLate(row) > 0;
  return openInsts(row).some((i) => i.daysLate === 0);
}

// ---------- small pieces ----------

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium
        transition-colors active:scale-95`,
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="backdrop"
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-[9999] mx-auto max-h-[88dvh]
              max-w-md overflow-y-auto rounded-t-3xl border-t border-border
              bg-card pb-[max(env(safe-area-inset-bottom),1rem)]
              shadow-[0_-8px_40px_rgba(0,0,0,0.3)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </div>
            {children}
          </m.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Checkbox({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border-strong border-muted-foreground/40",
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

// ---------- pay sheet ----------

type Pays = Record<string, number>;

function PayForm({
  row,
  startEditing,
  onConfirm,
  onEditRecorded,
  onOpenBorrower,
}: {
  row: Row;
  startEditing: boolean;
  onConfirm: (rowId: string, pays: Pays) => void;
  onEditRecorded?: () => void;
  onOpenBorrower?: () => void;
}) {
  const open = openInsts(row);
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(open.map((i) => [i.id, true])),
  );
  const [editing, setEditing] = useState(startEditing);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((i) => [i.id, String(left(i))])),
  );

  const pays: Pays = {};
  for (const i of open) {
    if (!picked[i.id]) continue;
    const typed = editing ? Number(amounts[i.id]) : left(i);
    const value = Math.min(left(i), Math.max(0, round2(typed || 0)));
    if (value > 0) pays[i.id] = value;
  }
  const total = round2(Object.values(pays).reduce((s, n) => s + n, 0));
  const group = GROUPS[row.group];

  return (
    <div className="px-5 pt-2 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <BorrowerTitle name={row.name} onOpen={onOpenBorrower} />
        <span className="text-xs text-muted-foreground lowercase">
          {group?.name}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {open.length} installment{open.length === 1 ? "" : "s"} ·{" "}
        {peso(rowLeft(row))} due
      </p>

      <ul className="mt-3 space-y-2">
        {open.map((i) => (
          <li key={i.id} className="space-y-2.5 rounded-2xl bg-muted/40 p-3">
            <AccountSummary {...fakeSummary(i)} />
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPicked((p) => ({ ...p, [i.id]: !p[i.id] }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPicked((p) => ({ ...p, [i.id]: !p[i.id] }));
                }
              }}
              className={cn(
                `flex w-full cursor-pointer items-center gap-3 rounded-xl border
                p-3 text-left transition-colors`,
                picked[i.id]
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-background",
              )}
            >
              <Checkbox on={!!picked[i.id]} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium capitalize">
                  {kindLabel(i.kind)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {i.due}
                  {i.daysLate > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">
                      {" "}
                      · {i.daysLate}d late
                    </span>
                  )}
                  {i.paid > 0 && ` · ${peso(i.paid)} already paid`}
                </span>
              </span>
              {editing ? (
                <Input
                  inputMode="decimal"
                  value={amounts[i.id]}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setAmounts((a) => ({ ...a, [i.id]: e.target.value }))
                  }
                  className="h-9 w-24 text-right tabular-nums"
                  aria-label={`Amount for ${kindLabel(i.kind)}`}
                />
              ) : (
                <span className="text-sm font-semibold tabular-nums">
                  {peso(left(i))}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="mt-3 text-sm font-medium text-primary"
      >
        {editing ? "Use full amounts" : "Pay a different amount"}
      </button>
      {onEditRecorded && row.insts.some((i) => i.paid > 0) && (
        <button
          type="button"
          onClick={onEditRecorded}
          className="mt-1 block text-sm font-medium text-muted-foreground"
        >
          Edit recorded payments
        </button>
      )}

      <Button
        size="lg"
        disabled={total <= 0}
        onClick={() => onConfirm(row.id, pays)}
        className="mt-3 h-12 w-full text-base"
      >
        {total <= 0 ? "Pick an installment" : `Record ${peso(total)} paid`}
      </Button>
    </div>
  );
}

/** Sheet title: the borrower's name, which opens their page like the real pills do. */
function BorrowerTitle({
  name,
  onOpen,
}: {
  name: string;
  onOpen?: () => void;
}) {
  if (!onOpen) {
    return <h2 className="text-lg font-semibold lowercase">{name}</h2>;
  }
  return (
    <h2 className="text-lg font-semibold lowercase">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 text-left active:opacity-70"
      >
        {name}
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
    </h2>
  );
}

/** Mirrors the real "Mark all as paid" dialog: a summary and a payment date. */
function BulkPaidForm({
  rows,
  date,
  onCancel,
  onConfirm,
}: {
  rows: Row[];
  date: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [paidDate, setPaidDate] = useState(date);
  const open = rows.flatMap((r) => openInsts(r));
  const total = round2(open.reduce((s, i) => s + left(i), 0));
  const borrowers = new Set(rows.filter((r) => !settled(r)).map((r) => r.name))
    .size;
  const already = rows.flatMap((r) => r.insts).length - open.length;
  const line = (label: string, value: ReactNode, strong = false) => (
    <div
      className={cn(
        "flex justify-between",
        strong && "mt-1 border-t border-border pt-1",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="px-5 pt-2 pb-3">
      <div
        className="flex size-10 items-center justify-center rounded-full
          bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40
          dark:text-emerald-300"
      >
        <Check className="size-5" />
      </div>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">
        Mark all as paid
      </h2>
      <p className="text-sm text-muted-foreground">
        Records the full amount as paid for every unchecked item in Collect and
        checks them off.
      </p>
      <div className="mt-3 rounded-lg border border-border bg-card p-3 text-sm">
        {line("Borrowers", borrowers)}
        {line("Collections to mark paid", open.length)}
        {already > 0 && line("Already paid", already)}
        {line("Total", peso(total), true)}
      </div>
      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Payment date
        <Input
          type="date"
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
          className="mt-1.5 h-10 font-semibold"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-11 flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="lg"
          className="h-11 flex-1"
          disabled={open.length === 0 || !paidDate}
          onClick={onConfirm}
        >
          Mark all paid
        </Button>
      </div>
    </div>
  );
}

function NoteForm({
  row,
  onSave,
}: {
  row: Row;
  onSave: (rowId: string, note: string) => void;
}) {
  const [text, setText] = useState(row.note ?? "");
  return (
    <div className="px-5 pt-2 pb-2">
      <h2 className="text-lg font-semibold lowercase">{row.name}</h2>
      <p className="text-sm text-muted-foreground">Note for today</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Promised to pay on the 22nd"
        className="mt-3 min-h-24"
        autoFocus
      />
      <Button
        size="lg"
        className="mt-3 h-12 w-full text-base"
        onClick={() => onSave(row.id, text.trim())}
      >
        Save note
      </Button>
    </div>
  );
}

// ---------- today's list menu ----------

function MenuForm({
  unpaid,
  total,
  canUndoPopulate,
  onPopulate,
  onMarkAll,
  onUndoPopulate,
  onClear,
}: {
  unpaid: number;
  total: number;
  canUndoPopulate: boolean;
  onPopulate: () => void;
  onMarkAll: () => void;
  onUndoPopulate: () => void;
  onClear: () => void;
}) {
  const item = (
    icon: ReactNode,
    title: string,
    hint: string | null,
    onClick: () => void,
    danger = false,
  ) => (
    <li key={title}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl border
          border-border bg-background p-3 text-left active:bg-muted"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            danger
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm font-semibold",
              danger && "text-destructive",
            )}
          >
            {title}
          </span>
          {hint && (
            <span className="block text-xs text-muted-foreground">{hint}</span>
          )}
        </span>
      </button>
    </li>
  );
  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-lg font-semibold">Today&apos;s list</h2>
      <ul className="mt-3 space-y-2">
        {item(
          <Plus className="size-4" />,
          "Populate due",
          "Everyone due today or up to 7 days late who isn't listed yet",
          onPopulate,
        )}
        {unpaid > 0 &&
          item(
            <Check className="size-4" />,
            `Mark all paid (${unpaid})`,
            null,
            onMarkAll,
          )}
        {canUndoPopulate &&
          item(
            <Undo2 className="size-4" />,
            "Undo populate",
            null,
            onUndoPopulate,
            true,
          )}
        {total > 0 &&
          item(
            <Trash2 className="size-4" />,
            `Clear all (${total})`,
            null,
            onClear,
            true,
          )}
      </ul>
    </div>
  );
}

// ---------- row menu ----------

function RowMenuForm({
  row,
  onEditItem,
  onOpenBorrower,
  onRemove,
}: {
  row: Row;
  onEditItem: () => void;
  onOpenBorrower: () => void;
  onRemove: () => void;
}) {
  const entry = (
    icon: ReactNode,
    title: string,
    onClick: () => void,
    danger = false,
  ) => (
    <li key={title}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl border
          border-border bg-background p-3 text-left active:bg-muted"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            danger
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </span>
        <span
          className={cn("text-sm font-semibold", danger && "text-destructive")}
        >
          {title}
        </span>
      </button>
    </li>
  );
  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-lg font-semibold lowercase">{row.name}</h2>
      <p className="text-sm text-muted-foreground">
        {settled(row) ? "Paid" : `${peso(rowLeft(row))} left`}
      </p>
      <ul className="mt-3 space-y-2">
        {entry(<Pencil className="size-4" />, "Edit item", onEditItem)}
        {entry(
          <ExternalLink className="size-4" />,
          "Open borrower page",
          onOpenBorrower,
        )}
        {entry(
          <Trash2 className="size-4" />,
          "Remove from list",
          onRemove,
          true,
        )}
      </ul>
    </div>
  );
}

// ---------- add item: composer with @ mentions and /next ----------
// Same two features as the real checklist input: "@name" mentions a borrower,
// and "/next" lists that borrower's upcoming dues to link as installments.
// On a phone both also have buttons, and /next is a step inside the sheet.

type Borrower = { id: string; name: string; group: string };

const BORROWERS: Borrower[] = [
  ...INITIAL_ROWS.map((r) => ({
    id: `b-${r.id}`,
    name: r.name,
    group: r.group,
  })),
  { id: "b-nora", name: "Nora Villanueva", group: "rose" },
  { id: "b-carlo", name: "Carlo Estrada", group: "chowking" },
  { id: "b-tess", name: "Tess Mercado", group: "topserve" },
  { id: "b-carla", name: "Carla Mendoza", group: "fifteenth" },
  { id: "b-efren", name: "Efren Tan", group: "fifteenth" },
].filter((b, i, all) => all.findIndex((x) => x.name === b.name) === i);

/** Dues that aren't on today's list yet, for borrowers whose schedule differs. */
const UPCOMING: Record<string, Array<[Kind, string, number]>> = {
  "Nora Villanueva": [
    ["loan", "oct 22", 2100],
    ["ca", "oct 22", 500],
    ["loan", "nov 6", 2100],
  ],
  "Carlo Estrada": [
    ["loan", "oct 23", 1750],
    ["loan", "nov 7", 1750],
  ],
  "Tess Mercado": [["loan", "oct 20", 980]],
};

function duesFor(b: Borrower): Inst[] {
  const spec = UPCOMING[b.name];
  if (spec) {
    return spec.map(([kind, due, amount], i) =>
      inst(`u-${b.id}-${i}`, kind, due, 0, amount),
    );
  }
  const base = INITIAL_ROWS.find((r) => r.name === b.name)?.insts[0];
  const kind = base?.kind ?? "loan";
  const amount = base?.amount ?? 1000;
  return [
    inst(`u-${b.id}-0`, kind, "nov 4", 0, amount),
    inst(`u-${b.id}-1`, kind, "nov 19", 0, amount),
  ];
}

/** Manual-schedule accounts: /next offers "Add payment" instead of installments. */
const MANUAL: Record<
  string,
  { kind: Kind; paid: number; left: number; rolling?: boolean }
> = {
  "Dante Uy": { kind: "loan", paid: 4000, left: 8000 },
  "Nora Villanueva": { kind: "ca", paid: 0, left: 2500, rolling: true },
};

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .toLowerCase();

/** Same header the real payment dialogs show above an account's schedules. */
function AccountSummary({
  kind,
  paid,
  left: remaining,
  done,
  total,
}: {
  kind: Kind;
  paid: number;
  left: number;
  done?: number;
  total?: number;
}) {
  const all = paid + remaining;
  const pct = all > 0 ? Math.round(Math.min(100, (paid / all) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            `rounded border px-1.5 py-0.5 text-[11px] leading-none font-semibold
            lowercase`,
            kind === "ca"
              ? `border-amber-300/60 bg-amber-100 text-amber-800
                dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200`
              : `border-violet-300/60 bg-violet-100 text-violet-800
                dark:border-violet-700 dark:bg-violet-900/40
                dark:text-violet-200`,
          )}
        >
          {kindLabel(kind)}
        </span>
        {total ? (
          <span
            className="text-xs font-semibold text-slate-700 tabular-nums
              dark:text-slate-300"
          >
            {done} of {total} paid
          </span>
        ) : null}
      </div>
      <div
        className="flex h-1.5 overflow-hidden rounded-full bg-slate-100
          dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% paid`}
      >
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div
        className="flex justify-between text-[11px] text-muted-foreground
          tabular-nums"
      >
        <span>
          {peso(paid)} paid · {pct}%
        </span>
        <span>{peso(remaining)} left</span>
      </div>
    </div>
  );
}

/** Stand-in account numbers for the demo, steady for a given installment. */
function fakeSummary(i: Inst) {
  const seed = [...i.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const total = 20;
  const done = 3 + (seed % 14);
  return {
    kind: i.kind,
    total,
    done,
    paid: round2(done * i.amount),
    left: round2((total - done) * i.amount),
  };
}

function MentionPill({
  borrower,
  onRemove,
}: {
  borrower: Borrower;
  onRemove?: () => void;
}) {
  const color = GROUPS[borrower.group]?.color ?? "#94a3b8";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1
        text-sm font-semibold lowercase"
      style={{ backgroundColor: `${color}24`, borderColor: `${color}80` }}
    >
      {borrower.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${borrower.name}`}
          className="text-muted-foreground"
        >
          ×
        </button>
      )}
    </span>
  );
}

function AddForm({
  mode,
  date,
  rows,
  edit,
  onAddCollection,
  onSaveEdit,
  onAddRelease,
  onAddNote,
}: {
  mode: "collect" | "release";
  date: string;
  rows: Row[];
  /** Editing this row's item instead of adding a new one. */
  edit?: Row;
  onAddCollection: (b: Borrower, insts: Inst[], note: string) => void;
  onSaveEdit: (rowId: string, insts: Inst[], note: string) => void;
  onAddRelease: (r: Omit<Release, "id" | "created">) => void;
  onAddNote: (text: string) => void;
}) {
  const editBorrower = edit
    ? (BORROWERS.find((b) => b.name === edit.name) ?? null)
    : null;
  const [view, setView] = useState<"compose" | "borrowers" | "dues" | "manual">(
    "compose",
  );
  const [text, setText] = useState(edit?.note ?? "");
  // Several people can be mentioned; /next and dues use the last one, as in the real input.
  const [mentions, setMentions] = useState<Borrower[]>(
    editBorrower ? [editBorrower] : [],
  );
  const [picked, setPicked] = useState<Inst[]>(edit ? edit.insts : []);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(date);

  const borrower = mentions.length ? mentions[mentions.length - 1] : null;
  const isRelease = mode === "release";
  const canMention = !edit;
  const atMatch = canMention ? text.match(/(?:^|\s)@([^\s@]*)$/) : null;
  const atQuery = atMatch ? atMatch[1].toLowerCase() : null;
  const suggestions =
    atQuery === null
      ? []
      : BORROWERS.filter((b) => b.name.toLowerCase().includes(atQuery)).slice(
          0,
          4,
        );

  const chooseBorrower = (b: Borrower) => {
    if (borrower?.id !== b.id) setPicked([]);
    setMentions((m) => [...m.filter((x) => x.id !== b.id), b]);
    setHint(null);
    setText((t) => t.replace(/(^|\s)@[^\s@]*$/, "$1"));
    setView("compose");
  };

  const removeMention = (id: string) => {
    if (borrower?.id === id) setPicked([]);
    setMentions((m) => m.filter((x) => x.id !== id));
  };

  const dues = borrower ? duesFor(borrower) : [];
  const manual = borrower ? (MANUAL[borrower.name] ?? null) : null;

  const openDues = () => {
    if (!borrower) {
      setHint("Mention a borrower first (@name)");
      return;
    }
    setHint(null);
    setSelection(
      Object.fromEntries(
        dues.map((d) => [d.id, picked.some((p) => p.id === d.id)]),
      ),
    );
    setView("dues");
  };

  const onText = (value: string) => {
    if (/\/next\b/.test(value)) {
      setText(value.replace(/\/next\b/, "").replace(/ {2,}/g, " "));
      openDues();
      return;
    }
    setText(value);
    setHint(null);
  };

  // What the real note parser makes of a Release entry as you type it.
  const parsed =
    isRelease && borrower && text.trim()
      ? parseReleasedLabel(
          `[${borrower.name}](/borrowers/${borrower.id}) ${text}`,
          date,
        )
      : null;

  const chosen = dues.filter((d) => selection[d.id]);
  const chosenTotal = round2(chosen.reduce((s, d) => s + d.amount, 0));
  const hadFromDues = picked.some((p) => dues.some((d) => d.id === p.id));
  const onList = borrower
    ? rows.find((r) => r.name === borrower.name)
    : undefined;

  const canAdd = isRelease
    ? !!parsed
    : edit
      ? picked.length > 0
      : picked.length > 0 || text.trim().length > 0;

  const submit = () => {
    if (isRelease) {
      if (!borrower || !parsed) return;
      const v = parsed.initialValues;
      onAddRelease({
        name: borrower.name,
        amount: Number(v.principal_amount ?? 0),
        kind: v.type === "cash_advance" ? "ca" : "loan",
        term: Number(v.term_months ?? 1),
        typed: `${borrower.name.toLowerCase()} ${text.trim()}`,
        first: v.first_payment_date || undefined,
      });
      return;
    }
    if (edit) {
      onSaveEdit(edit.id, picked, text.trim());
      return;
    }
    const others = mentions
      .filter((m) => m.id !== borrower?.id)
      .map((m) => m.name.toLowerCase());
    const note = [text.trim(), others.length ? `with ${others.join(", ")}` : ""]
      .filter(Boolean)
      .join(" · ");
    if (borrower && picked.length > 0) {
      onAddCollection(borrower, picked, note);
      return;
    }
    onAddNote(note);
  };

  const back = (to: "compose" | "dues") => (
    <button
      type="button"
      onClick={() => setView(to)}
      className="mb-2 text-sm font-medium text-muted-foreground"
    >
      ‹ Back
    </button>
  );

  if (view === "borrowers") {
    const list = BORROWERS.filter((b) =>
      b.name.toLowerCase().includes(query.toLowerCase()),
    );
    return (
      <div className="px-5 pt-2 pb-4">
        {back("compose")}
        <h2 className="text-lg font-semibold">Mention a borrower</h2>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search borrowers"
          className="mt-3 h-10"
        />
        <ul className="mt-2 max-h-[45dvh] overflow-y-auto">
          {list.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => chooseBorrower(b)}
                className="flex w-full items-center gap-2 border-b border-border
                  py-2.5 text-left lowercase"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: GROUPS[b.group]?.color }}
                />
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view === "manual" && borrower && manual) {
    const amt = Number(payAmount.replace(/,/g, "")) || 0;
    const tooMuch = amt > manual.left;
    return (
      <div className="px-5 pt-2 pb-2">
        {back("dues")}
        <h2 className="text-lg font-semibold">Add payment</h2>
        <p className="text-sm text-muted-foreground lowercase">
          {borrower.name} · manual account
        </p>
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <AccountSummary
            kind={manual.kind}
            paid={manual.paid}
            left={manual.left}
          />
        </div>
        {manual.rolling && (
          <p className="mt-2 text-xs text-muted-foreground">
            Rolling account: what&apos;s left of the open schedule rolls into a
            new one with interest.
          </p>
        )}
        <label className="mt-3 block text-sm font-medium">
          Amount paid
          <div className="relative mt-1">
            <span
              className="pointer-events-none absolute top-1/2 left-3
                -translate-y-1/2 text-slate-400"
            >
              ₱
            </span>
            <Input
              inputMode="decimal"
              autoFocus
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0"
              className="h-10 pl-7 text-right font-semibold tabular-nums"
            />
          </div>
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[500, 1000, 2000, manual.left].map((n, i) => (
            <ValueChip
              key={`${n}-${i}`}
              active={amt === n}
              onClick={() => setPayAmount(String(n))}
            >
              {i === 3 ? `All ${n.toLocaleString()}` : n.toLocaleString()}
            </ValueChip>
          ))}
        </div>
        {tooMuch && (
          <p
            className="mt-1.5 text-sm font-medium text-red-600
              dark:text-red-400"
          >
            That&apos;s more than the {peso(manual.left)} left.
          </p>
        )}
        <label className="mt-3 block text-sm font-medium">
          Payment date
          <Input
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            className="mt-1 h-10"
          />
        </label>
        <Button
          size="lg"
          disabled={amt <= 0 || tooMuch || !payDate}
          className="mt-4 h-12 w-full text-base"
          onClick={() => {
            const manualInst: Inst = {
              ...inst(
                `m-${borrower.id}-${picked.length}-${amt}`,
                manual.kind,
                shortDate(payDate),
                0,
                amt,
                amt,
              ),
              manual: true,
            };
            setPicked((p) => [...p, manualInst]);
            setPayAmount("");
            setView("compose");
          }}
        >
          {amt > 0 && !tooMuch ? `Record ${peso(amt)}` : "Enter an amount"}
        </Button>
      </div>
    );
  }

  if (view === "dues" && borrower) {
    return (
      <div className="px-5 pt-2 pb-2">
        {back("compose")}
        <h2 className="text-lg font-semibold">Next dues</h2>
        <p className="text-sm text-muted-foreground lowercase">
          {borrower.name}
          {onList && openInsts(onList).length > 0 && (
            <span className="normal-case">
              {" "}
              · {openInsts(onList).length} already on the list
            </span>
          )}
        </p>

        <ul className="mt-3 space-y-2">
          <li>
            <button
              type="button"
              onClick={() =>
                setSelection(
                  Object.fromEntries(
                    dues.map((d) => [d.id, chosen.length !== dues.length]),
                  ),
                )
              }
              className="flex w-full items-center gap-3 rounded-xl border
                border-border bg-background p-3 text-left"
            >
              <Checkbox on={chosen.length === dues.length} />
              <span className="flex-1 text-sm font-medium">Select all</span>
              <span className="text-sm font-semibold tabular-nums">
                {peso(round2(dues.reduce((s, d) => s + d.amount, 0)))}
              </span>
            </button>
          </li>
          {dues.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() =>
                  setSelection((s) => ({ ...s, [d.id]: !s[d.id] }))
                }
                className={cn(
                  `flex w-full items-center gap-3 rounded-xl border p-3
                  text-left transition-colors`,
                  selection[d.id]
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background",
                )}
              >
                <Checkbox on={!!selection[d.id]} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium capitalize">
                    {kindLabel(d.kind)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {d.due}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {peso(d.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {manual && (
          <div
            className="mt-3 rounded-xl border border-border bg-background p-3"
          >
            <p
              className="mb-2 text-xs font-semibold tracking-wider
                text-muted-foreground uppercase"
            >
              Manual account
            </p>
            <AccountSummary
              kind={manual.kind}
              paid={manual.paid}
              left={manual.left}
            />
            <Button
              variant="outline"
              className="mt-3 h-10 w-full"
              onClick={() => setView("manual")}
            >
              Add payment
            </Button>
          </div>
        )}

        <Button
          size="lg"
          disabled={chosen.length === 0 && !hadFromDues}
          className="mt-4 h-12 w-full text-base"
          onClick={() => {
            setPicked([
              ...picked.filter((p) => !dues.some((d) => d.id === p.id)),
              ...chosen,
            ]);
            setView("compose");
          }}
        >
          {chosen.length > 0
            ? `Add ${chosen.length} · ${peso(chosenTotal)}`
            : hadFromDues
              ? "Remove picked dues"
              : "Pick a due"}
        </Button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-2 pb-2">
      <h2 className="text-lg font-semibold">
        {edit
          ? "Edit item"
          : `Add to ${date === TODAY_ISO ? "today" : "this day"}`}{" "}
        <span className="text-sm font-normal text-muted-foreground lowercase">
          · {edit ? edit.name : isRelease ? "Release" : "Collect"}
        </span>
      </h2>

      <div className="mt-3 rounded-xl border border-border bg-background p-3">
        {(mentions.length > 0 || picked.length > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {mentions.map((m) => (
              <MentionPill
                key={m.id}
                borrower={m}
                onRemove={canMention ? () => removeMention(m.id) : undefined}
              />
            ))}
            {picked.map((d) => (
              <span
                key={d.id}
                className={cn(
                  `inline-flex items-center gap-1 rounded-full px-2.5 py-1
                  text-xs font-medium`,
                  d.manual
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted",
                )}
              >
                {d.manual
                  ? `${d.kind === "ca" ? "CA" : "Loan"} · ${peso(d.amount)} paid`
                  : `${d.due} · ${d.kind === "ca" ? "CA" : "Loan"} · ${peso(d.amount)}`}
                <button
                  type="button"
                  aria-label={`Remove ${d.due} ${kindLabel(d.kind)}`}
                  onClick={() =>
                    setPicked((p) => p.filter((x) => x.id !== d.id))
                  }
                  className="text-muted-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          autoFocus
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={
            isRelease
              ? borrower
                ? "10,000 - 10 months for 110426"
                : "Start with @ to pick the borrower"
              : edit
                ? "Add a note"
                : "Type a note, @ for a borrower, /next for dues"
          }
          className="w-full bg-transparent text-[15px] outline-none
            placeholder:text-muted-foreground"
        />
        {picked.length > 1 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Total {peso(round2(picked.reduce((s, d) => s + d.amount, 0)))}
          </p>
        )}
        {mentions.length > 1 && (
          <p className="mt-2 text-xs text-muted-foreground lowercase">
            <span className="normal-case">Dues and /next use</span>{" "}
            {borrower?.name}
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul
          className="mt-2 overflow-hidden rounded-xl border border-border
            bg-card"
        >
          {suggestions.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => chooseBorrower(b)}
                className="flex w-full items-center gap-2 border-b border-border
                  px-3 py-2.5 text-left text-sm lowercase last:border-b-0"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: GROUPS[b.group]?.color }}
                />
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          {hint}
        </p>
      )}
      {parsed && (
        <p className="mt-2 text-sm text-muted-foreground">
          Reads as{" "}
          <span className="font-medium text-foreground">
            {peso(Number(parsed.initialValues.principal_amount ?? 0))}{" "}
            {parsed.initialValues.type === "cash_advance"
              ? "cash advance"
              : "loan"}
          </span>
          {parsed.initialValues.term_months
            ? ` · ${parsed.initialValues.term_months} months`
            : ""}
          {parsed.initialValues.first_payment_date
            ? ` · first payment ${formatDate(parsed.initialValues.first_payment_date)}`
            : ""}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {canMention && (
          <button
            type="button"
            onClick={() => setView("borrowers")}
            className="flex h-10 items-center gap-1.5 rounded-full border
              border-border px-4 text-sm font-medium active:bg-muted"
          >
            @ Borrower
          </button>
        )}
        {!isRelease && (
          <button
            type="button"
            onClick={openDues}
            className="flex h-10 items-center gap-1.5 rounded-full border
              border-border px-4 text-sm font-medium active:bg-muted"
          >
            ₱ Next dues
          </button>
        )}
      </div>

      <div
        className="sticky bottom-0 -mx-5 mt-4 border-t border-border bg-card
          px-5 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <Button
          size="lg"
          disabled={!canAdd}
          className="h-12 w-full text-base"
          onClick={submit}
        >
          {isRelease
            ? "Add release"
            : edit
              ? "Save changes"
              : picked.length > 0
                ? `Add ${picked.length} item${picked.length === 1 ? "" : "s"}`
                : "Add item"}
        </Button>
      </div>
    </div>
  );
}

// ---------- edit recorded payments ----------

function EditPaidForm({
  row,
  onSave,
  onOpenBorrower,
}: {
  row: Row;
  onOpenBorrower?: () => void;
  onSave: (
    rowId: string,
    paid: Record<string, number>,
    removed: boolean,
  ) => void;
}) {
  const recorded = row.insts.filter((i) => i.paid > 0);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(recorded.map((i) => [i.id, String(i.paid)])),
  );
  const next = (i: Inst) =>
    Math.min(i.amount, Math.max(0, round2(Number(amounts[i.id]) || 0)));
  const changed = recorded.some((i) => next(i) !== i.paid);
  const newTotal = round2(recorded.reduce((s, i) => s + next(i), 0));
  const paidNow = round2(recorded.reduce((s, i) => s + i.paid, 0));

  return (
    <div className="px-5 pt-2 pb-2">
      <BorrowerTitle name={row.name} onOpen={onOpenBorrower} />
      <p className="text-sm text-muted-foreground">
        Recorded payments · {peso(paidNow)}
      </p>

      <ul className="mt-3 space-y-2">
        {recorded.map((i) => (
          <li
            key={i.id}
            className="rounded-xl border border-border bg-background p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium capitalize">
                  {kindLabel(i.kind)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i.due} · due {peso(i.amount)}
                </p>
              </div>
              <Input
                inputMode="decimal"
                value={amounts[i.id]}
                onChange={(e) =>
                  setAmounts((a) => ({ ...a, [i.id]: e.target.value }))
                }
                className="h-9 w-28 text-right tabular-nums"
                aria-label={`Amount paid for ${kindLabel(i.kind)}`}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <Chip
                active={next(i) === i.amount}
                onClick={() =>
                  setAmounts((a) => ({ ...a, [i.id]: String(i.amount) }))
                }
              >
                Paid in full
              </Chip>
              <Chip
                active={next(i) === 0}
                onClick={() => setAmounts((a) => ({ ...a, [i.id]: "0" }))}
              >
                Not paid
              </Chip>
            </div>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        disabled={!changed}
        className="mt-4 h-12 w-full text-base"
        onClick={() =>
          onSave(
            row.id,
            Object.fromEntries(recorded.map((i) => [i.id, next(i)])),
            newTotal === 0,
          )
        }
      >
        {!changed
          ? "Change an amount to save"
          : newTotal === 0
            ? "Remove payment"
            : `Save · ${peso(newTotal)} paid`}
      </Button>
    </div>
  );
}

// ---------- create account sheet ----------
// Mirrors components/forms/account-form.tsx (same fields, order, labels, chip
// options and validation). It never saves: the real form writes to the
// database, so this one only shows a toast.

type Frequency = "weekly" | "bimonthly" | "monthly" | "custom";
type Tone = "emerald" | "amber" | "sky" | "violet" | "red";

const PILL_ON: Record<Tone, string> = {
  emerald:
    "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-300",
  amber:
    "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-300",
  sky: "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-300",
  violet:
    "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-900/30 dark:text-violet-300",
  red: "border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300",
};
const PILL_OFF =
  "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-card dark:text-muted-foreground dark:hover:bg-muted";

function RadioPill({
  name,
  checked,
  tone,
  onSelect,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  tone: Tone;
  onSelect: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cn(
        `flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2
        text-sm font-semibold transition`,
        checked ? PILL_ON[tone] : PILL_OFF,
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span>{label}</span>
      {hint && (
        <span className="text-[10px] font-normal opacity-70">{hint}</span>
      )}
    </label>
  );
}

function ValueChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? `border-slate-700 bg-slate-700 text-white dark:border-foreground
            dark:bg-foreground dark:text-background`
          : PILL_OFF,
      )}
    >
      {children}
    </button>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Next occurrence of each common first-payment day, after the release date. */
function firstPaymentOptions(releaseIso: string) {
  const base = releaseIso ? new Date(releaseIso) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();
  return [4, 5, 7, 8, 10, 15]
    .map((d) => {
      const target =
        d > day
          ? new Date(year, month, d)
          : new Date(year + (month + 1 > 11 ? 1 : 0), (month + 1) % 12, d);
      const y = target.getFullYear();
      const m = String(target.getMonth() + 1).padStart(2, "0");
      const dd = String(target.getDate()).padStart(2, "0");
      return {
        value: `${y}-${m}-${dd}`,
        label: target.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        ts: target.getTime(),
      };
    })
    .sort((a, b) => a.ts - b.ts);
}

function CreateForm({
  date,
  release,
  onCreate,
}: {
  date: string;
  release: Release | null;
  onCreate: (r: {
    name: string;
    amount: number;
    kind: Kind;
    term: number;
  }) => void;
}) {
  const [name, setName] = useState(release?.name ?? NAMES[0]);
  const [type, setType] = useState<"loan" | "cash_advance">(
    release?.kind === "ca" ? "cash_advance" : "loan",
  );
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [status, setStatus] = useState<"active" | "pending">("active");
  const [interestType, setInterestType] = useState<"flat" | "rolling">("flat");
  const [principalText, setPrincipalText] = useState(
    release ? release.amount.toLocaleString() : "",
  );
  const [rateText, setRateText] = useState("3.8");
  const [releaseDate, setReleaseDate] = useState(date);
  const [firstDate, setFirstDate] = useState(release?.first ?? "");
  const [skipped, setSkipped] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("bimonthly");
  const [termText, setTermText] = useState(release ? String(release.term) : "");
  const [submitted, setSubmitted] = useState(false);

  const isManual = mode === "manual";
  const isPending = status === "pending";
  const isRolling = isManual && interestType === "rolling";
  const isCustom = frequency === "custom";
  const needsSchedule = !isManual && !isPending;

  const principal = Number(principalText.replace(/,/g, "")) || 0;
  const rate = Number(rateText.replace(",", ".")) || 0;
  const term = Number(termText.replace(",", ".")) || 0;

  const errors: Record<string, string> = {};
  if (!(principal > 0))
    errors.principal = "Principal amount must be greater than 0";
  if (rate < 0) errors.rate = "Interest rate cannot be negative";
  else if (rate > 100) errors.rate = "Interest rate cannot exceed 100%";
  if (!releaseDate) errors.release = "Release date is required";
  if (needsSchedule) {
    if (!firstDate) errors.first = "First payment date is required";
    if (isCustom) {
      if (!Number.isInteger(term) || term < 1)
        errors.term = "Term must be a whole number for custom";
    } else if (term % 0.5 !== 0) errors.term = "Term must be in 0.5 increments";
    else if (term <= 0) errors.term = "Term is required";
  }
  const show = (key: string) => (submitted ? errors[key] : undefined);

  // The real schedule builder, so the numbers match what saving would create.
  let preview: {
    count: number;
    each: number;
    first: string;
    last: string;
  } | null = null;
  if (needsSchedule && Object.keys(errors).length === 0) {
    try {
      const rows = buildSchedulesPayload("preview", {
        principal_amount: principal,
        interest_rate: rate,
        term_months: term,
        first_payment_date: firstDate,
        payment_frequency: frequency,
        release_date: releaseDate,
        calculate_skipped_schedules: skipped,
      });
      if (rows.length) {
        preview = {
          count: rows.length,
          each: rows[0].amount_due,
          first: rows[0].due_date,
          last: rows[rows.length - 1].due_date,
        };
      }
    } catch {
      preview = null;
    }
  }

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    onCreate({
      name,
      amount: principal,
      kind: type === "cash_advance" ? "ca" : "loan",
      term,
    });
    toast.success("Account created", {
      position: "top-center",
      className:
        "!border-green-200 !bg-green-50 !text-green-900 dark:!border-green-900 dark:!bg-green-950 dark:!text-green-100",
      classNames: { description: "!text-green-800 dark:!text-green-200" },
      description: (
        <div className="mt-1 flex flex-col gap-1 text-sm">
          {(
            [
              [
                "Borrower",
                <span key="b" className="font-semibold">
                  {name}
                </span>,
              ],
              [
                "Principal",
                <span key="p" className="font-semibold">
                  {formatMoney(principal)}
                </span>,
              ],
              [
                "Type",
                <span
                  key="t"
                  className="rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium text-green-900 dark:bg-green-900 dark:text-green-100"
                >
                  {type === "cash_advance" ? "Cash advance" : "Loan"}
                </span>,
              ],
              [
                "Release date",
                <span key="r" className="font-semibold">
                  {formatDate(releaseDate)}
                </span>,
              ],
              ...(needsSchedule && firstDate
                ? ([
                    [
                      "First payment",
                      <span key="f" className="font-semibold">
                        {formatDate(firstDate)}
                      </span>,
                    ],
                  ] as const)
                : []),
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">
                {label}
              </span>
              {value}
            </div>
          ))}
        </div>
      ),
    });
  };

  return (
    <div className="px-5 pt-2">
      <h2 className="text-lg font-semibold">Create account</h2>
      {release ? (
        <p className="text-sm text-muted-foreground">
          Filled in from your note:{" "}
          <span className="lowercase">“{release.typed}”</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Loan or cash advance for a borrower.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {!release && (
          <div>
            <label className={formFieldLabelClassName} htmlFor="mock-borrower">
              Borrower
            </label>
            <select
              id="mock-borrower"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formFieldInputClassName}
            >
              {NAMES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={formFieldLabelClassName}>Account type</label>
          <div className="flex gap-2">
            <RadioPill
              name="type"
              checked={type === "loan"}
              tone="emerald"
              label="loan"
              onSelect={() => setType("loan")}
            />
            <RadioPill
              name="type"
              checked={type === "cash_advance"}
              tone="amber"
              label="cash advance"
              onSelect={() => setType("cash_advance")}
            />
          </div>
        </div>

        <div>
          <label className={formFieldLabelClassName}>Schedule mode</label>
          <div className="flex gap-2">
            <RadioPill
              name="mode"
              checked={mode === "auto"}
              tone="sky"
              label="auto"
              hint="generate schedules"
              onSelect={() => setMode("auto")}
            />
            <RadioPill
              name="mode"
              checked={mode === "manual"}
              tone="violet"
              label="manual"
              hint="add schedules yourself"
              onSelect={() => setMode("manual")}
            />
          </div>
        </div>

        <div>
          <label className={formFieldLabelClassName}>Account status</label>
          <div className="flex gap-2">
            <RadioPill
              name="status"
              checked={!isPending}
              tone="emerald"
              label="active"
              onSelect={() => setStatus("active")}
            />
            <RadioPill
              name="status"
              checked={isPending}
              tone="amber"
              label="pending"
              onSelect={() => setStatus("pending")}
            />
          </div>
          {isPending && (
            <p
              className="mt-1.5 text-xs text-slate-500
                dark:text-muted-foreground"
            >
              Payment schedules will be created when this account is activated.
              A calendar event will be added using the release date.
            </p>
          )}
        </div>

        {isManual && (
          <div>
            <label className={formFieldLabelClassName}>Interest type</label>
            <div className="flex gap-2">
              <RadioPill
                name="interest"
                checked={interestType === "flat"}
                tone="violet"
                label="flat"
                hint="fixed total"
                onSelect={() => setInterestType("flat")}
              />
              <RadioPill
                name="interest"
                checked={interestType === "rolling"}
                tone="violet"
                label="rolling"
                hint="applies each cycle"
                onSelect={() => setInterestType("rolling")}
              />
            </div>
            {isRolling && (
              <p
                className="mt-1.5 text-xs text-slate-500
                  dark:text-muted-foreground"
              >
                First schedule auto-created on save. Each partial payment
                generates the next cycle with interest on remaining balance.
              </p>
            )}
          </div>
        )}

        <div>
          <label className={formFieldLabelClassName} htmlFor="mock-principal">
            Principal amount
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute top-1/2 left-3
                -translate-y-1/2 text-lg font-bold text-slate-400"
            >
              ₱
            </span>
            <input
              id="mock-principal"
              type="text"
              inputMode="decimal"
              value={principalText}
              onChange={(e) => setPrincipalText(e.target.value)}
              onBlur={() => {
                const n = Number(principalText.replace(/,/g, ""));
                setPrincipalText(n > 0 ? n.toLocaleString() : "");
              }}
              onFocus={(e) => e.target.select()}
              className={`${formFieldInputClassName} pl-8 text-right text-lg
                font-bold`}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[5000, 10000, 15000, 20000, 30000, 40000, 50000].map((amt) => (
              <ValueChip
                key={amt}
                active={principal === amt}
                onClick={() => setPrincipalText(amt.toLocaleString())}
              >
                {amt.toLocaleString()}
              </ValueChip>
            ))}
          </div>
          {show("principal") && (
            <p className={formFieldErrorClassName}>{show("principal")}</p>
          )}
        </div>

        <div>
          <label className={formFieldLabelClassName} htmlFor="mock-rate">
            Interest rate (%)
          </label>
          <input
            id="mock-rate"
            type="text"
            inputMode="decimal"
            value={rateText}
            onChange={(e) => setRateText(e.target.value.replace(",", "."))}
            onFocus={(e) => e.target.select()}
            className={formFieldInputClassName}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[3.3, 3.8, 4, 5].map((r) => (
              <ValueChip
                key={r}
                active={rate === r}
                onClick={() => setRateText(String(r))}
              >
                {r}%
              </ValueChip>
            ))}
          </div>
          {show("rate") && (
            <p className={formFieldErrorClassName}>{show("rate")}</p>
          )}
        </div>

        <div className="grid gap-4">
          <div className="min-w-0">
            <label className={formFieldLabelClassName} htmlFor="mock-release">
              Release date
            </label>
            <input
              id="mock-release"
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className={`${formFieldInputClassName} min-w-0`}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ValueChip onClick={() => setReleaseDate(TODAY_ISO)}>
                today
              </ValueChip>
            </div>
            {show("release") && (
              <p className={formFieldErrorClassName}>{show("release")}</p>
            )}
          </div>

          {needsSchedule && releaseDate && (
            <div className="min-w-0">
              <label className={formFieldLabelClassName} htmlFor="mock-first">
                First payment date
              </label>
              <input
                id="mock-first"
                type="date"
                min={releaseDate}
                value={firstDate}
                onChange={(e) => setFirstDate(e.target.value)}
                className={`${formFieldInputClassName} min-w-0`}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {firstPaymentOptions(releaseDate).map(({ value, label }) => (
                  <ValueChip
                    key={value}
                    active={firstDate === value}
                    onClick={() => setFirstDate(value)}
                  >
                    {label}
                  </ValueChip>
                ))}
              </div>
              {show("first") && (
                <p className={formFieldErrorClassName}>{show("first")}</p>
              )}
            </div>
          )}
        </div>

        {needsSchedule && (
          <>
            <div>
              <label className={formFieldLabelClassName}>
                Calculate skipped schedules
              </label>
              <div className="flex gap-2">
                <RadioPill
                  name="skipped"
                  checked={skipped}
                  tone="emerald"
                  label="yes"
                  onSelect={() => setSkipped(true)}
                />
                <RadioPill
                  name="skipped"
                  checked={!skipped}
                  tone="red"
                  label="no"
                  onSelect={() => setSkipped(false)}
                />
              </div>
            </div>

            <div>
              <label
                className={formFieldLabelClassName}
                htmlFor="mock-frequency"
              >
                Payment frequency
              </label>
              <select
                id="mock-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className={formFieldInputClassName}
              >
                <option value="weekly">weekly</option>
                <option value="bimonthly">bimonthly</option>
                <option value="monthly">monthly</option>
                <option value="custom">custom</option>
              </select>
              {releaseDate && firstDate && frequency === "bimonthly" && (
                <p
                  className="mt-1.5 text-sm font-bold text-slate-600
                    dark:text-slate-300"
                >
                  {(() => {
                    const [a1, a2] = deriveBimonthlyAnchors(
                      new Date(firstDate).getDate(),
                    );
                    return `(${ordinal(a1)} & ${ordinal(a2)})`;
                  })()}
                </p>
              )}
            </div>

            <div>
              <label className={formFieldLabelClassName} htmlFor="mock-term">
                {isCustom ? "Term installments (gives)" : "Term (months)"}
              </label>
              <input
                id="mock-term"
                type="text"
                inputMode={isCustom ? "numeric" : "decimal"}
                value={termText}
                onChange={(e) => setTermText(e.target.value.replace(",", "."))}
                onFocus={(e) => e.target.select()}
                className={formFieldInputClassName}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[1, 2, 3, 5, 6, 10, 12].map((m) => (
                  <ValueChip
                    key={m}
                    active={term === m}
                    onClick={() => setTermText(String(m))}
                  >
                    {m}
                  </ValueChip>
                ))}
              </div>
              {show("term") && (
                <p className={formFieldErrorClassName}>{show("term")}</p>
              )}
            </div>
          </>
        )}

        {preview && (
          <div className="rounded-xl bg-muted/60 p-3 text-sm">
            <span className="font-semibold tabular-nums">
              {preview.count} × {peso(preview.each)}
            </span>{" "}
            <span className="text-muted-foreground">
              {formatDate(preview.first)} to {formatDate(preview.last)}
            </span>
          </div>
        )}
      </div>

      <div
        className="sticky bottom-0 -mx-5 mt-4 border-t border-border bg-card
          px-5 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <Button size="lg" className="h-12 w-full text-base" onClick={submit}>
          Create account
        </Button>
      </div>
    </div>
  );
}

// ---------- row ----------

const ACTIONS_W = 192;

function RowItem({
  row,
  swiped,
  onSwiped,
  expanded,
  onExpand,
  onOpenPay,
  onPayInst,
  onPayAll,
  onEdit,
  onPartial,
  onNote,
  onMore,
  waiting,
  highlight,
}: {
  row: Row;
  swiped: boolean;
  onSwiped: (open: boolean) => void;
  expanded: boolean;
  onExpand: () => void;
  onOpenPay: () => void;
  onPayInst: (inst: Inst) => void;
  onPayAll: () => void;
  onEdit: () => void;
  onPartial: () => void;
  onNote: () => void;
  onMore: () => void;
  /** Changed while offline and not synced yet. */
  waiting: boolean;
  /** Just changed from another device. */
  highlight: boolean;
}) {
  const controls = useAnimationControls();
  // A swipe must not also count as a tap on the row.
  const dragged = useRef(false);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const done = settled(row);
  const multi = openInsts(row).length > 1;
  const sub = subline(row);
  const amount = done
    ? round2(row.insts.reduce((s, i) => s + i.amount, 0))
    : rowLeft(row);

  useEffect(() => {
    if (!swiped) {
      void controls.start({
        x: 0,
        transition: { type: "spring", stiffness: 500, damping: 40 },
      });
    }
  }, [swiped, controls]);

  const settle = (open: boolean) => {
    void controls.start({
      x: open ? -ACTIONS_W : 0,
      transition: { type: "spring", stiffness: 500, damping: 40 },
    });
    onSwiped(open);
  };

  return (
    <li
      className="relative overflow-hidden border-b border-border
        last:border-b-0"
    >
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: ACTIONS_W }}
        aria-hidden={!swiped}
      >
        <button
          type="button"
          tabIndex={swiped ? 0 : -1}
          onClick={() => {
            settle(false);
            if (done) onEdit();
            else onPartial();
          }}
          className="flex-1 bg-amber-500 text-sm font-semibold text-white"
        >
          {done ? "Payment" : "Partial"}
        </button>
        <button
          type="button"
          tabIndex={swiped ? 0 : -1}
          onClick={() => {
            settle(false);
            onNote();
          }}
          className="flex-1 bg-slate-600 text-sm font-semibold text-white"
        >
          Note
        </button>
        <button
          type="button"
          tabIndex={swiped ? 0 : -1}
          onClick={() => {
            settle(false);
            onMore();
          }}
          className="flex-1 bg-slate-400 text-sm font-semibold text-white
            dark:bg-slate-500"
        >
          More
        </button>
      </div>

      <m.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTIONS_W, right: 0 }}
        dragElastic={0.08}
        animate={controls}
        onTapStart={(_, info) => {
          dragged.current = false;
          downAt.current = info.point;
        }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(_, info) =>
          settle(info.offset.x < -48 || info.velocity.x < -300)
        }
        onTap={(event, info) => {
          if (dragged.current) return;
          // Finger moved: that was a swipe, not a tap.
          const from = downAt.current;
          if (
            from &&
            Math.hypot(info.point.x - from.x, info.point.y - from.y) > 8
          )
            return;
          // Taps on the row's own buttons are handled by those buttons.
          if ((event.target as HTMLElement | null)?.closest("button")) return;
          if (swiped) return settle(false);
          if (done) onEdit();
          else if (multi) onExpand();
          else onOpenPay();
        }}
        className={cn(
          "relative touch-pan-y transition-colors duration-700",
          highlight ? "bg-primary/15" : "bg-card",
        )}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <div className={cn("min-w-0 flex-1", done && "opacity-55")}>
            <p
              className={cn(
                "truncate text-[15px] font-medium lowercase",
                done && "line-through",
              )}
            >
              {row.name}
              {row.note && (
                <NotebookPen
                  className="ml-1.5 inline size-3.5 text-amber-500"
                  aria-label="Has a note"
                />
              )}
              {waiting && (
                <CloudUpload
                  className="ml-1.5 inline size-3.5 text-sky-500"
                  aria-label="Waiting to sync"
                />
              )}
            </p>
            <p
              className={cn(
                "truncate text-xs",
                sub.late
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground",
              )}
            >
              {sub.text}
            </p>
          </div>
          <span
            className={cn(
              "text-[15px] font-semibold tabular-nums",
              done && "text-muted-foreground opacity-55",
            )}
          >
            {peso(amount)}
          </span>
          {done ? (
            <button
              type="button"
              aria-label={`Edit payment for ${row.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="-mr-1 flex size-11 items-center justify-center"
            >
              <span
                className="flex size-8 items-center justify-center rounded-full
                  bg-primary text-primary-foreground"
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            </button>
          ) : multi ? (
            <button
              type="button"
              aria-label={`Pay ${openInsts(row).length} installments for ${row.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenPay();
              }}
              className="flex h-9 items-center gap-1 rounded-full border
                border-border-strong border-muted-foreground/40 px-3 text-sm
                font-semibold transition-colors active:bg-muted"
            >
              Pay {openInsts(row).length}
            </button>
          ) : (
            <button
              type="button"
              aria-label={`Mark ${row.name} paid`}
              onClick={(e) => {
                e.stopPropagation();
                onPayAll();
              }}
              className="-mr-1 flex size-11 items-center justify-center"
            >
              <span
                className={cn(
                  `flex size-8 items-center justify-center rounded-full border
                    text-muted-foreground transition-colors active:bg-primary
                    active:text-primary-foreground`,
                  row.insts.some((i) => i.paid > 0)
                    ? "border-primary/50 text-primary"
                    : "border-muted-foreground/40",
                )}
              >
                <Check className="size-4" strokeWidth={2.5} />
              </span>
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && multi && (
            <m.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-4 mb-3 rounded-xl bg-muted/50 px-3 py-1">
                {row.insts.map((i) => {
                  const remaining = left(i);
                  return (
                    <div
                      key={i.id}
                      className="flex items-center gap-3 border-b border-border
                        py-2 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">
                          {kindLabel(i.kind)}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            i.daysLate > 0 && remaining > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {i.due}
                          {i.daysLate > 0 && remaining > 0
                            ? ` · ${i.daysLate}d late`
                            : ""}
                          {remaining <= 0 ? " · paid" : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {peso(remaining > 0 ? remaining : i.amount)}
                      </span>
                      <button
                        type="button"
                        disabled={remaining <= 0}
                        aria-label={`Pay ${kindLabel(i.kind)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPayInst(i);
                        }}
                        className="flex size-10 items-center justify-center"
                      >
                        <span
                          className={cn(
                            `flex size-8 items-center justify-center
                            rounded-full border`,
                            remaining <= 0
                              ? `border-transparent bg-primary
                                text-primary-foreground`
                              : `border-muted-foreground/40
                                text-muted-foreground`,
                          )}
                        >
                          <Check className="size-4" strokeWidth={2.5} />
                        </span>
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPayAll();
                  }}
                  className="my-2 w-full rounded-lg bg-primary/10 py-2 text-sm
                    font-semibold text-primary active:bg-primary/20"
                >
                  Pay all {peso(rowLeft(row))}
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </li>
  );
}

// ---------- screen ----------

type SheetState =
  | { kind: "pay"; rowId: string; editing: boolean }
  | { kind: "edit"; rowId: string }
  | { kind: "note"; rowId: string }
  | { kind: "rowmenu"; rowId: string }
  | { kind: "editrow"; rowId: string }
  | { kind: "add" }
  | { kind: "menu" }
  | { kind: "bulk" }
  | { kind: "create"; releaseId: string | null };

export default function ChecklistMockup() {
  const [date, setDate] = useState(TODAY_ISO);
  const [rowsByDate, setRowsByDate] = useState<Record<string, Row[]>>({
    [TODAY_ISO]: INITIAL_ROWS,
  });
  const [releasesByDate, setReleasesByDate] = useState<
    Record<string, Release[]>
  >({ [TODAY_ISO]: INITIAL_RELEASES });
  const rows = rowsByDate[date] ?? EMPTY_ROWS;
  const releases = releasesByDate[date] ?? EMPTY_RELEASES;
  // Each day has its own list, as in the real checklist. Toast Undo buttons
  // keep the day they were created on.
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [waitingIds, setWaitingIds] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });
  const setRows = (u: Row[] | ((p: Row[]) => Row[])) => {
    if (offline) {
      // Offline, every change is saved on this device and waits to sync.
      const cur = rowsRef.current;
      const next = typeof u === "function" ? u(cur) : u;
      const changed = next
        .filter((r) => cur.find((c) => c.id === r.id) !== r)
        .map((r) => r.id);
      setQueued((n) => n + 1);
      setWaitingIds((prev) => new Set([...prev, ...changed]));
    }
    setRowsByDate((prev) => {
      const cur = prev[date] ?? EMPTY_ROWS;
      return { ...prev, [date]: typeof u === "function" ? u(cur) : u };
    });
  };

  const goOffline = () => {
    toast.dismiss();
    setOffline(true);
    toast.info("You're offline. Changes are saved here and sync later.");
  };
  const goOnline = () => {
    setOffline(false);
    const n = queued;
    window.setTimeout(() => {
      setWaitingIds(new Set());
      setQueued(0);
      if (n > 0) {
        toast.success(`Synced ${n} offline change${n === 1 ? "" : "s"}.`);
      }
    }, 1200);
  };
  // Another device pays a row: it updates here live and flashes briefly.
  const simulateRemote = () => {
    if (offline) {
      toast.info("No live updates while offline. They arrive on reconnect.");
      return;
    }
    const target = rows.find((r) => !settled(r));
    if (!target) {
      toast("Everything on this list is already paid");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === target.id
          ? {
              ...r,
              insts: r.insts.map((i) => ({ ...i, paid: i.amount })),
            }
          : r,
      ),
    );
    setFlashId(target.id);
    toast(`${target.name.toLowerCase()} was marked paid on another device`);
    window.setTimeout(() => setFlashId(null), 2500);
  };
  const setReleases = (u: Release[] | ((p: Release[]) => Release[])) =>
    setReleasesByDate((prev) => {
      const cur = prev[date] ?? EMPTY_RELEASES;
      return { ...prev, [date]: typeof u === "function" ? u(cur) : u };
    });
  const isToday = date === TODAY_ISO;
  const dateInputRef = useRef<HTMLInputElement>(null);
  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  };
  const [mode, setMode] = useState<"collect" | "release">("collect");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Bumped on every open so a sheet never reuses the last one's leftovers while it is still animating out.
  const [sheetSeq, setSheetSeq] = useState(0);

  const changeDate = (next: string) => {
    toast.dismiss();
    setSwipedId(null);
    setExpandedId(null);
    setFilter("all");
    setLastPopulate(null);
    setDate(next);
  };

  const openSheet = (s: SheetState) => {
    // A toast would otherwise sit on top of the sheet's main button.
    toast.dismiss();
    setSheetSeq((n) => n + 1);
    setSwipedId(null);
    setSheet(s);
    setSheetOpen(true);
  };
  const closeSheet = () => setSheetOpen(false);
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const totals = useMemo(() => {
    const due = rows.reduce(
      (s, r) => s + r.insts.reduce((a, i) => a + i.amount, 0),
      0,
    );
    const remaining = rows.reduce((s, r) => s + rowLeft(r), 0);
    return {
      left: round2(remaining),
      collected: round2(due - remaining),
      due: round2(due),
      done: rows.filter(settled).length,
    };
  }, [rows]);

  const counts: Record<Filter, number> = {
    all: rows.length,
    overdue: rows.filter((r) => matches(r, "overdue")).length,
    today: rows.filter((r) => matches(r, "today")).length,
    paid: rows.filter((r) => matches(r, "paid")).length,
  };

  const applyPays = (rowId: string, pays: Pays, label: string) => {
    const before = rows.find((r) => r.id === rowId);
    if (!before) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id !== rowId
          ? r
          : {
              ...r,
              insts: r.insts.map((i) =>
                pays[i.id]
                  ? {
                      ...i,
                      paid: round2(Math.min(i.amount, i.paid + pays[i.id])),
                    }
                  : i,
              ),
            },
      ),
    );
    toast(label, {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () =>
          setRows((prev) => prev.map((r) => (r.id === rowId ? before : r))),
      },
    });
  };

  const applyPaid = (
    rowId: string,
    paid: Record<string, number>,
    label: string,
  ) => {
    const before = rows.find((r) => r.id === rowId);
    if (!before) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id !== rowId
          ? r
          : {
              ...r,
              insts: r.insts.map((i) =>
                paid[i.id] !== undefined ? { ...i, paid: paid[i.id] } : i,
              ),
            },
      ),
    );
    toast(label, {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () =>
          setRows((prev) => prev.map((r) => (r.id === rowId ? before : r))),
      },
    });
  };

  const payRow = (row: Row) => {
    const pays: Pays = {};
    for (const i of openInsts(row)) pays[i.id] = left(i);
    applyPays(
      row.id,
      pays,
      `${row.name.toLowerCase()} · ${peso(rowLeft(row))} paid`,
    );
  };

  const buildGroups = (list: Row[]) =>
    Object.keys(GROUPS)
      .map((key) => ({
        key,
        ...GROUPS[key],
        rows: list
          .filter((r) => r.group === key)
          .sort((a, b) => Number(settled(a)) - Number(settled(b))),
      }))
      .filter((g) => g.rows.length > 0);

  const visible = rows.filter((r) => matches(r, filter));
  const todayGroups = buildGroups(visible.filter((r) => !isCarried(r)));
  const carriedGroups = buildGroups(visible.filter(isCarried));
  const carriedRows = carriedGroups.flatMap((g) => g.rows);

  const renderGroup = (
    g: ReturnType<typeof buildGroups>[number],
    section: string,
  ) => {
    const key = `${section}:${g.key}`;
    const isCollapsed = collapsed.has(key);
    const groupLeft = round2(g.rows.reduce((s, r) => s + rowLeft(r), 0));
    return (
      <div
        key={key}
        style={{ "--grp": g.color } as CSSProperties}
        className="border-b border-border last:border-b-0"
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          aria-expanded={!isCollapsed}
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs
            font-semibold lowercase
            bg-[color:color-mix(in_oklab,var(--grp)_8%,var(--card))]"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: g.color }}
          />
          <span className="truncate">{g.name}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {g.rows.filter(settled).length}/{g.rows.length}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {groupLeft > 0 && (
              <span className="tabular-nums">{peso(groupLeft)}</span>
            )}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                isCollapsed && "-rotate-90",
              )}
            />
          </span>
        </button>
        {!isCollapsed && (
          <ul>
            {g.rows.map((row) => (
              <RowItem
                key={row.id}
                row={row}
                swiped={swipedId === row.id}
                onSwiped={(open) => setSwipedId(open ? row.id : null)}
                expanded={expandedId === row.id}
                onExpand={() =>
                  setExpandedId((id) => (id === row.id ? null : row.id))
                }
                onOpenPay={() =>
                  openSheet({ kind: "pay", rowId: row.id, editing: false })
                }
                onPayInst={(i) =>
                  applyPays(
                    row.id,
                    { [i.id]: left(i) },
                    `${row.name.toLowerCase()} · ${kindLabel(i.kind)} ${peso(left(i))} paid`,
                  )
                }
                onPayAll={() => payRow(row)}
                onEdit={() => openSheet({ kind: "edit", rowId: row.id })}
                onPartial={() =>
                  openSheet({ kind: "pay", rowId: row.id, editing: true })
                }
                onNote={() => openSheet({ kind: "note", rowId: row.id })}
                onMore={() => openSheet({ kind: "rowmenu", rowId: row.id })}
                waiting={waitingIds.has(row.id)}
                highlight={flashId === row.id}
              />
            ))}
          </ul>
        )}
      </div>
    );
  };

  const sheetRow =
    sheet && "rowId" in sheet ? rows.find((r) => r.id === sheet.rowId) : null;
  const sheetRelease =
    sheet?.kind === "create" && sheet.releaseId
      ? (releases.find((r) => r.id === sheet.releaseId) ?? null)
      : null;

  const [lastPopulate, setLastPopulate] = useState<string[] | null>(null);

  const undoPopulate = (ids: string[]) => {
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    setLastPopulate(null);
  };

  // Same rule as the real action: one row per borrower who has something due
  // (today or up to 7 days late) and isn't already listed.
  const populateDue = () => {
    const listed = new Set(rows.map((r) => r.name));
    const missing = poolFor(date).filter((r) => !listed.has(r.name));
    if (missing.length === 0) {
      toast(
        "Nothing new to add — everyone due or carried over is already listed",
      );
      return;
    }
    const ids = missing.map((r) => r.id);
    setRows((prev) => [...prev, ...missing]);
    setLastPopulate(ids);
    toast(
      `Added ${missing.length} borrower${missing.length === 1 ? "" : "s"}`,
      {
        duration: 8000,
        action: { label: "Undo", onClick: () => undoPopulate(ids) },
      },
    );
  };

  const markAllPaid = () => {
    const before = rows;
    const open = rows.flatMap((r) => openInsts(r)).length;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        insts: r.insts.map((i) => ({ ...i, paid: i.amount })),
      })),
    );
    toast(`Marked ${open} collection${open === 1 ? "" : "s"} paid`, {
      duration: 6000,
      action: { label: "Undo", onClick: () => setRows(before) },
    });
  };

  const clearAll = () => {
    const before = rows;
    setRows([]);
    setLastPopulate(null);
    toast(`Cleared ${before.length} items`, {
      duration: 6000,
      action: { label: "Undo", onClick: () => setRows(before) },
    });
  };

  const removeRow = (row: Row) => {
    const before = rows;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast(`${row.name.toLowerCase()} removed from the list`, {
      duration: 6000,
      action: { label: "Undo", onClick: () => setRows(before) },
    });
  };

  const saveEditedRow = (rowId: string, insts: Inst[], note: string) => {
    const before = rows.find((r) => r.id === rowId);
    if (!before) return;
    const withLate = insts.map((i) => ({
      ...i,
      daysLate: Math.max(0, diffDays(i.iso, date)),
    }));
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, insts: withLate, note: note || undefined } : r,
      ),
    );
    toast("Item updated", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () =>
          setRows((prev) => prev.map((r) => (r.id === rowId ? before : r))),
      },
    });
  };

  const reset = () => {
    setRowsByDate({ [TODAY_ISO]: INITIAL_ROWS });
    setReleasesByDate({ [TODAY_ISO]: INITIAL_RELEASES });
    setDate(TODAY_ISO);
    setFilter("all");
    setCollapsed(new Set());
    setExpandedId(null);
    setSwipedId(null);
  };

  const progress = totals.due > 0 ? (totals.collected / totals.due) * 100 : 0;
  const releasedTotal = releases.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-md pb-32">
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => changeDate(shiftIso(date, -1))}
              className="-ml-2 flex size-9 items-center justify-center
                rounded-full text-muted-foreground active:bg-muted"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Pick a date"
              onClick={openDatePicker}
              className="flex items-center gap-1.5 rounded-lg px-1 py-1"
            >
              <span
                className="text-xs font-semibold tracking-wider
                  text-muted-foreground uppercase"
              >
                {longDate(date)}
              </span>
              {relativeLabel(date) && (
                <span
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px]
                    font-semibold text-muted-foreground"
                >
                  {relativeLabel(date)}
                </span>
              )}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => e.target.value && changeDate(e.target.value)}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute size-px opacity-0"
            />
            <button
              type="button"
              aria-label="Next day"
              onClick={() => changeDate(shiftIso(date, 1))}
              className="flex size-9 items-center justify-center rounded-full
                text-muted-foreground active:bg-muted"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {mode === "collect" && (
              <button
                type="button"
                aria-label="Today's list options"
                onClick={() => openSheet({ kind: "menu" })}
                className="flex size-9 items-center justify-center rounded-full
                  border border-border bg-card text-muted-foreground
                  active:scale-95"
              >
                <MoreHorizontal className="size-5" />
              </button>
            )}
            <button
              type="button"
              aria-label="Add to today"
              onClick={() => openSheet({ kind: "add" })}
              className="flex size-9 items-center justify-center rounded-full
                bg-primary text-primary-foreground active:scale-95"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>

        {!isToday && (
          <button
            type="button"
            onClick={() => changeDate(TODAY_ISO)}
            className="mt-1 text-xs font-semibold text-primary"
          >
            Back to today
          </button>
        )}
        {mode === "collect" ? (
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-semibold tracking-tight tabular-nums"
              >
                {peso(totals.left)}
              </span>
              <span className="text-sm text-muted-foreground">left</span>
              <span
                className="ml-auto text-sm text-muted-foreground tabular-nums"
              >
                {totals.done}/{rows.length} paid
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full rounded-full bg-primary transition-all
                  duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {peso(releasedTotal)}
            </span>
            <span className="text-sm text-muted-foreground">
              released {isToday ? "today" : "this day"}
            </span>
          </div>
        )}
      </div>

      <div
        className="sticky top-[var(--mock-top,3.5rem)] z-20 mt-3 space-y-2
          border-b border-border bg-background/95 px-4 pt-2 pb-2.5
          backdrop-blur"
      >
        <div className="flex rounded-xl bg-secondary p-0.5 text-sm font-medium">
          {(
            [
              ["collect", `Collect ${rows.length}`],
              ["release", `Release ${releases.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "flex-1 rounded-[10px] py-1.5 transition-colors",
                mode === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "collect" && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {(
              [
                ["all", "All"],
                ["overdue", "Overdue"],
                ["today", "Today"],
                ["paid", "Paid"],
              ] as const
            ).map(([key, label]) => (
              <Chip
                key={key}
                active={filter === key}
                onClick={() => setFilter(key)}
              >
                {label} {counts[key]}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {offline && (
        <div
          className="mx-3 mt-3 flex items-center gap-2 rounded-xl
            bg-slate-500/10 px-3 py-2 text-sm font-medium text-slate-700
            dark:text-slate-300"
          role="status"
        >
          <WifiOff className="size-4 shrink-0" />
          {queued > 0
            ? `Offline · ${queued} change${queued === 1 ? "" : "s"} waiting`
            : "Offline · showing saved data"}
        </div>
      )}

      {mode === "collect" ? (
        <div className="mt-3 space-y-3 px-3">
          {todayGroups.length > 0 && (
            <section
              className="overflow-hidden rounded-2xl border border-border
                bg-card"
            >
              {todayGroups.map((g) => renderGroup(g, "t"))}
            </section>
          )}
          {carriedGroups.length > 0 && (
            <section
              className="overflow-hidden rounded-2xl border border-border
                bg-card"
            >
              <button
                type="button"
                onClick={() => toggle("carry")}
                aria-expanded={!collapsed.has("carry")}
                className="flex w-full items-center gap-2 bg-amber-500/10 px-4
                  py-2.5 text-left text-xs font-semibold text-amber-800
                  lowercase dark:bg-amber-500/15 dark:text-amber-300"
              >
                <Undo2 className="size-3.5 shrink-0" />
                <span>carried over</span>
                <span className="tabular-nums">
                  {carriedRows.filter(settled).length}/{carriedRows.length}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="tabular-nums">
                    {peso(
                      round2(carriedRows.reduce((s, r) => s + rowLeft(r), 0)),
                    )}
                  </span>
                  {collapsed.has("carry") ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronUp className="size-3.5" />
                  )}
                </span>
              </button>
              {!collapsed.has("carry") &&
                carriedGroups.map((g) => renderGroup(g, "c"))}
            </section>
          )}
          {rows.length === 0 && (
            <div
              className="rounded-2xl border border-dashed border-border bg-card
                px-6 py-10 text-center"
            >
              <p className="text-base font-semibold">
                Nothing on {isToday ? "today's" : "this day's"} list
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pull in everyone who&apos;s due {isToday ? "today" : "this day"}{" "}
                or running late.
              </p>
              <Button
                size="lg"
                className="mt-4 h-11 px-6"
                onClick={populateDue}
              >
                Populate due
              </Button>
            </div>
          )}
          {rows.length > 0 &&
            todayGroups.length === 0 &&
            carriedGroups.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nothing here. Try another filter.
              </p>
            )}
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Swipe a row left for Partial or Note.{" "}
            <button type="button" onClick={reset} className="underline">
              Reset demo
            </button>
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3 px-3">
          {releases.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No releases on this day yet. Add one with the + button.
            </p>
          )}
          <section
            className={cn(
              "overflow-hidden rounded-2xl border border-border bg-card",
              releases.length === 0 && "hidden",
            )}
          >
            <ul>
              {releases.map((rel) => (
                <li
                  key={rel.id}
                  className="flex items-center gap-3 border-b border-border px-4
                    py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium lowercase">
                      {rel.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {peso(rel.amount)} · {kindLabel(rel.kind)} · {rel.term}{" "}
                      {rel.term === 1 ? "month" : "months"}
                    </p>
                    <p
                      className="truncate text-[11px] text-muted-foreground/70
                        lowercase"
                    >
                      “{rel.typed}”
                    </p>
                  </div>
                  {rel.created ? (
                    <span
                      className="flex items-center gap-1 rounded-full
                        bg-primary/10 px-3 py-1.5 text-sm font-medium
                        text-primary"
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                      Created
                    </span>
                  ) : (
                    <Button
                      onClick={() =>
                        openSheet({ kind: "create", releaseId: rel.id })
                      }
                      className="h-9 rounded-full px-4"
                    >
                      Create account
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <Button
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={() => openSheet({ kind: "create", releaseId: null })}
          >
            <HandCoins className="size-4" />
            New release
          </Button>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Typed notes are read for you: amount, term and dates fill the form.
          </p>
        </div>
      )}

      <div
        className="mx-3 mt-4 rounded-2xl border border-dashed border-border p-3"
      >
        <p
          className="text-xs font-semibold tracking-wider text-muted-foreground
            uppercase"
        >
          Demo controls
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-full px-4"
            onClick={offline ? goOnline : goOffline}
          >
            {offline ? "Go online" : "Go offline"}
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-full px-4"
            onClick={simulateRemote}
          >
            Update from another device
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={closeSheet}>
        <Fragment key={sheetSeq}>
          {sheet?.kind === "pay" && sheetRow && (
            <PayForm
              key={`${sheetRow.id}-${sheet.editing}`}
              row={sheetRow}
              startEditing={sheet.editing}
              onEditRecorded={() =>
                openSheet({ kind: "edit", rowId: sheetRow.id })
              }
              onOpenBorrower={() => {
                closeSheet();
                toast(`Opens ${sheetRow.name.toLowerCase()}'s page (demo)`);
              }}
              onConfirm={(rowId, pays) => {
                const total = round2(
                  Object.values(pays).reduce((s, n) => s + n, 0),
                );
                closeSheet();
                applyPays(
                  rowId,
                  pays,
                  `${sheetRow.name.toLowerCase()} · ${peso(total)} recorded`,
                );
              }}
            />
          )}
          {sheet?.kind === "edit" && sheetRow && (
            <EditPaidForm
              key={`${sheetRow.id}-edit`}
              row={sheetRow}
              onOpenBorrower={() => {
                closeSheet();
                toast(`Opens ${sheetRow.name.toLowerCase()}'s page (demo)`);
              }}
              onSave={(rowId, paid, removed) => {
                closeSheet();
                applyPaid(
                  rowId,
                  paid,
                  `${sheetRow.name.toLowerCase()} · ${removed ? "payment removed" : "payment updated"}`,
                );
              }}
            />
          )}
          {sheet?.kind === "note" && sheetRow && (
            <NoteForm
              key={sheetRow.id}
              row={sheetRow}
              onSave={(rowId, note) => {
                setRows((prev) =>
                  prev.map((r) => (r.id === rowId ? { ...r, note } : r)),
                );
                closeSheet();
                toast("Note saved");
              }}
            />
          )}
          {sheet?.kind === "rowmenu" && sheetRow && (
            <RowMenuForm
              row={sheetRow}
              onEditItem={() =>
                openSheet({ kind: "editrow", rowId: sheetRow.id })
              }
              onOpenBorrower={() => {
                closeSheet();
                toast(`Opens ${sheetRow.name.toLowerCase()}'s page (demo)`);
              }}
              onRemove={() => {
                closeSheet();
                removeRow(sheetRow);
              }}
            />
          )}
          {sheet?.kind === "editrow" && sheetRow && (
            <AddForm
              key={`edit-${sheetRow.id}`}
              mode="collect"
              date={date}
              rows={rows}
              edit={sheetRow}
              onAddCollection={() => {}}
              onAddRelease={() => {}}
              onAddNote={() => {}}
              onSaveEdit={(rowId, insts, note) => {
                closeSheet();
                saveEditedRow(rowId, insts, note);
              }}
            />
          )}
          {sheet?.kind === "bulk" && (
            <BulkPaidForm
              rows={rows}
              date={date}
              onCancel={closeSheet}
              onConfirm={() => {
                closeSheet();
                markAllPaid();
              }}
            />
          )}
          {sheet?.kind === "menu" && (
            <MenuForm
              unpaid={rows.filter((r) => !settled(r)).length}
              total={rows.length}
              canUndoPopulate={lastPopulate !== null}
              onPopulate={() => {
                closeSheet();
                populateDue();
              }}
              onMarkAll={() => openSheet({ kind: "bulk" })}
              onUndoPopulate={() => {
                closeSheet();
                if (lastPopulate) undoPopulate(lastPopulate);
              }}
              onClear={() => {
                closeSheet();
                clearAll();
              }}
            />
          )}
          {sheet?.kind === "add" && (
            <AddForm
              key={`add-${mode}`}
              mode={mode}
              date={date}
              rows={rows}
              onSaveEdit={() => {}}
              onAddCollection={(b, insts, note) => {
                closeSheet();
                setRows((prev) => {
                  insts = insts.map((i) => ({
                    ...i,
                    daysLate: Math.max(0, diffDays(i.iso, date)),
                  }));
                  const existing = prev.find((r) => r.name === b.name);
                  if (existing) {
                    return prev.map((r) =>
                      r.id === existing.id
                        ? {
                            ...r,
                            insts: [...r.insts, ...insts],
                            note: note || r.note,
                          }
                        : r,
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: `n${prev.length + 1}`,
                      name: b.name,
                      group: b.group,
                      insts,
                      note: note || undefined,
                    },
                  ];
                });
                toast(
                  `${b.name.toLowerCase()} · ${insts.length} due${insts.length === 1 ? "" : "s"} added · ${peso(
                    round2(insts.reduce((s, i) => s + i.amount, 0)),
                  )}`,
                );
              }}
              onAddRelease={(rel) => {
                closeSheet();
                setReleases((prev) => [
                  ...prev,
                  { ...rel, id: `x${prev.length + 1}`, created: false },
                ]);
                toast(`${rel.name.toLowerCase()} · release added`);
              }}
              onAddNote={() => {
                closeSheet();
                toast("Note added (demo only)");
              }}
            />
          )}
          {sheet?.kind === "create" && (
            <CreateForm
              key={sheet.releaseId ?? "new"}
              date={date}
              release={sheetRelease}
              onCreate={(r) => {
                closeSheet();
                setReleases((prev) =>
                  sheet.releaseId
                    ? prev.map((x) =>
                        x.id === sheet.releaseId ? { ...x, created: true } : x,
                      )
                    : [
                        ...prev,
                        {
                          id: `x${prev.length + 1}`,
                          name: r.name,
                          amount: r.amount,
                          kind: r.kind,
                          term: r.term,
                          typed: `${r.name.toLowerCase()} ${r.amount.toLocaleString()}`,
                          created: true,
                        },
                      ],
                );
              }}
            />
          )}
        </Fragment>
      </Sheet>
    </div>
  );
}
