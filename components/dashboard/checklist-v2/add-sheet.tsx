"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import { AccountSummaryHeader } from "@/components/dashboard/checklist/payment-dialogs";
import type { ChecklistItemsApi } from "@/components/dashboard/checklist-v2/use-checklist-items";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import { AmountInput } from "@/components/dashboard/checklist-v2/sheet-parts";
import { peso } from "@/components/dashboard/checklist-v2/header";
import { ProfitText } from "@/components/dashboard/checklist/profit-text";
import {
  atQuery,
  labelParts,
  removeAtToken,
  type ComposerBorrower,
} from "@/lib/checklist/composer";
import { fetchBorrowerNextAmounts } from "@/lib/checklist/next-amounts";
import { recordManualPayment } from "@/lib/checklist/manual-payment";
import {
  borrowerCategoryColor,
  formatShortDate,
  NO_BORROWERS,
  type ManualAccount,
  type NextCollectionItem,
} from "@/lib/checklist/labels";
import { todayDateValue } from "@/lib/checklist/dates";
import {
  activeBorrower,
  addMention,
  applyDuesSelection,
  borrowerName,
  chipText,
  detectNextTyped,
  duesStepButton,
  initialSelection,
  linesTotal,
  listedScheduleIds,
  MANUAL_UNCONFIRMED,
  manualFailureMessage,
  manualPaidMessage,
  manualPaymentCheck,
  manualQueuedMessage,
  manualQuickAmounts,
  manualSummaryLeft,
  MENTION_FIRST,
  offerDues,
  PAID_ROW_NOT_ADDED,
  paidLine,
  queuedRecordedRow,
  recordedRow,
  releaseDraft,
  releaseReadBack,
  removeMention,
  submitPlan,
  suggestBorrowers,
  toComposerBorrower,
  type AddMode,
  type DraftLine,
} from "@/lib/checklist/add-sheet";
import type { RowView } from "@/lib/checklist/row-state";
import type { AccountSummary } from "@/lib/checklist/schedule-cache";

/** What the add sheet writes through: the screen's `useChecklistItems`. */
export type AddSheetApi = Pick<
  ChecklistItemsApi,
  "items" | "loading" | "collectId" | "releasedId" | "addItems" | "setLabel"
>;

type View = "compose" | "borrowers" | "dues" | "manual";

type Dues =
  | { status: "idle" }
  | { status: "loading"; borrowerId: string }
  | {
      status: "ready";
      borrowerId: string;
      items: NextCollectionItem[];
      manualAccounts: ManualAccount[];
    };

/** Long enough for any real search; the list scrolls inside the sheet. */
const BORROWER_LIST_LIMIT = 60;

const kindName = (type: string) =>
  type === "cash_advance" ? "cash advance" : "loan";

function manualSummary(
  account: ManualAccount,
  left = account.remaining,
): AccountSummary {
  const isCashAdvance = account.type === "cash_advance";
  return {
    typeLabel: kindName(account.type),
    isCashAdvance,
    paid: account.paid,
    left,
    pct: 0,
    paidInstallments: 0,
    installmentCount: 0,
  };
}

const NO_PENDING = {
  paidAmount: 0,
  partialAmount: 0,
  installments: 0,
  undoAmount: 0,
  undoInstallments: 0,
};

/**
 * The "+" sheet: a composer with `@` mentions, `/next` dues and manual
 * account payments (Collect), a typed release line read back live (Release),
 * or an existing collection row's lines and note (edit).
 *
 * Render it inside `Sheet`, keyed per open, so each open starts empty.
 */
export function AddSheet({
  mode,
  date,
  edit,
  api,
  onOpenBorrower,
  onClose,
}: {
  mode: AddMode;
  date: string;
  /** Edit this collection row instead of adding one (Edit item). */
  edit?: RowView;
  api: AddSheetApi;
  /** Edit item: the borrower's name opens their page. */
  onOpenBorrower?(): void;
  onClose(): void;
}) {
  const isRelease = mode === "release" && !edit;
  const canMention = !edit;
  const disabled = api.loading;

  const initial = useMemo(
    () => (edit ? labelParts(edit.item.label, date) : null),
    // Only the first render's label: the sheet edits that version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [view, setView] = useState<View>("compose");
  const [text, setText] = useState(initial?.note ?? "");
  const [mentions, setMentions] = useState<ComposerBorrower[]>(
    initial?.borrower ? [initial.borrower] : [],
  );
  const [lines, setLines] = useState<DraftLine[]>(initial?.lines ?? []);
  const [hint, setHint] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dues, setDues] = useState<Dues>({ status: "idle" });
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [manualAccount, setManualAccount] = useState<ManualAccount | null>(
    null,
  );
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayDateValue);
  const [paying, setPaying] = useState(false);
  /** Manual accounts paid from this sheet: never offered a second time. */
  const [recorded, setRecorded] = useState<Record<string, number>>({});
  /**
   * Payments recorded from this sheet, shown as green chips. Each already has
   * its own ticked row, so they never go into the draft's label.
   */
  const [recordedLines, setRecordedLines] = useState<DraftLine[]>([]);
  /** Manual accounts whose payment from this sheet was queued offline. */
  const [queuedHere, setQueuedHere] = useState<Record<string, true>>({});
  /** Accounts whose last payment attempt ended without a clear answer. */
  const [unconfirmed, setUnconfirmed] = useState<Record<string, true>>({});

  // Synchronous guards against double taps (state updates land a frame late).
  const payingRef = useRef(false);
  const submittedRef = useRef(false);
  const duesSeq = useRef(0);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { data: borrowers = NO_BORROWERS } = useBorrowersSearch();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();

  // The sheet moves focus to itself after mounting; take it for the box.
  useEffect(() => {
    if (view !== "compose") return;
    const frame = requestAnimationFrame(() =>
      textRef.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [view]);

  const borrower = activeBorrower(mentions);
  const colorOf = (id: string) =>
    borrowerCategoryColor(borrowers.find((b) => b.id === id)) ?? "#94a3b8";

  const listed = useMemo(
    () => listedScheduleIds(api.items, edit?.item.id),
    [api.items, edit?.item.id],
  );
  const offer =
    dues.status === "ready"
      ? offerDues(dues.items, listed, recordedLines)
      : { offered: [], alreadyListed: 0 };

  const at = canMention ? atQuery(text) : null;
  const suggestions =
    at === null
      ? []
      : suggestBorrowers(
          borrowers,
          at,
          mentions.map((m) => m.id),
        );

  const plan = submitPlan({
    mode,
    mentions,
    lines,
    text,
    date,
    editOf: edit ? edit.item.label : null,
    recordedCount: recordedLines.length,
    collectId: api.collectId,
    releasedId: api.releasedId,
  });
  const release = isRelease ? releaseDraft(borrower, text, date) : null;

  const chooseBorrower = (b: ComposerBorrower) => {
    const next = addMention(mode, mentions, lines, b);
    setMentions(next.mentions);
    setLines(next.lines);
    setText((t) => (atQuery(t) === null ? t : removeAtToken(t)));
    setHint(null);
    setQuery("");
    setView("compose");
    // Picked from the inline list: keep typing in the box.
    requestAnimationFrame(() =>
      textRef.current?.focus({ preventScroll: true }),
    );
  };

  const dropMention = (id: string) => {
    const next = removeMention(mentions, lines, id);
    setMentions(next.mentions);
    setLines(next.lines);
  };

  const openDues = () => {
    if (!borrower) {
      setHint(MENTION_FIRST);
      return;
    }
    setHint(null);
    setView("dues");
    // Already loaded for this borrower: keep the list, refresh the ticks.
    if (dues.status === "ready" && dues.borrowerId === borrower.id) {
      setSelection(initialSelection(offer.offered, lines));
      return;
    }
    const seq = ++duesSeq.current;
    const borrowerId = borrower.id;
    setDues({ status: "loading", borrowerId });
    void fetchBorrowerNextAmounts(borrowerId).then((data) => {
      if (seq !== duesSeq.current) return;
      setDues({ status: "ready", borrowerId, ...data });
      setSelection(
        initialSelection(
          offerDues(data.items, listed, recordedLines).offered,
          lines,
        ),
      );
    });
  };

  const onText = (value: string) => {
    const typed = isRelease
      ? { text: value, opened: false }
      : detectNextTyped(text, value);
    setText(typed.text);
    if (typed.opened) openDues();
    else setHint(null);
  };

  const submit = () => {
    if (!plan.ok || disabled || submittedRef.current) return;
    submittedRef.current = true;
    if (plan.action === "edit") {
      if (edit) api.setLabel(edit.item.id, plan.label);
      onClose();
      return;
    }
    if (plan.action === "add") {
      void api.addItems([{ label: plan.label, categoryId: plan.categoryId }]);
    }
    onClose();
  };

  /**
   * Records a manual payment and, the moment it is saved, adds its own ticked
   * row. Everything the row needs is read now, so the row goes in even if the
   * sheet closes (or the day changes) while the payment is saving: a recorded
   * payment always gets exactly one row.
   */
  const recordPayment = async (account: ManualAccount) => {
    const check = manualPaymentCheck(account, payAmount);
    const who = borrower;
    if (
      !who ||
      !check.canSave ||
      check.amount === null ||
      disabled ||
      payingRef.current ||
      recorded[account.id] !== undefined
    ) {
      return;
    }
    const amount = check.amount;
    const { addItems, collectId } = api;
    payingRef.current = true;
    setPaying(true);
    try {
      const result = await recordManualPayment({
        account,
        amount,
        paidDate: payDate,
      });
      if (!result.ok && "queued" in result) {
        // Held by the service worker: it replays by itself. Same as saved
        // here (a ticked row, marked waiting), and never offered again.
        const row = queuedRecordedRow(
          who,
          account,
          result.schedule,
          amount,
          collectId,
        );
        const notAdded = () => toast.error(PAID_ROW_NOT_ADDED);
        void addItems([{ ...row, waiting: true }])
          .then((rows) => {
            if (rows.length === 0) notAdded();
          })
          .catch(notAdded);
        toast.success(manualQueuedMessage(amount));
        const line = paidLine(
          result.schedule ?? {
            id: `queued-${account.id}`,
            due_date: payDate,
            amount,
            type: account.type,
          },
        );
        setRecorded((r) => ({ ...r, [account.id]: amount }));
        setQueuedHere((q) => ({ ...q, [account.id]: true }));
        setUnconfirmed((u) => {
          const next = { ...u };
          delete next[account.id];
          return next;
        });
        setRecordedLines((prev) => [
          ...prev.filter((l) => l.id !== line.id),
          line,
        ]);
        setPayAmount("");
        setManualAccount(null);
        setView("compose");
        return;
      }
      if (!result.ok) {
        // Stay on the step. After an unclear outcome the step keeps saying
        // so, and the retry is labelled as one.
        if (result.unknown) {
          setUnconfirmed((u) => ({ ...u, [account.id]: true }));
        }
        toast.error(manualFailureMessage(result));
        return;
      }
      const row = recordedRow(who, result.schedule, collectId);
      const notAdded = () => toast.error(PAID_ROW_NOT_ADDED);
      void addItems([row])
        .then((rows) => {
          if (rows.length === 0) notAdded();
        })
        .catch(notAdded);
      invalidateBorrowerDetails(who.id);
      toast.success(manualPaidMessage(amount, check.rollover, check.nextDue));
      setRecorded((r) => ({ ...r, [account.id]: amount }));
      setRecordedLines((prev) => [
        ...prev.filter((l) => l.id !== result.schedule.id),
        paidLine(result.schedule),
      ]);
      setPayAmount("");
      setManualAccount(null);
      setView("compose");
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const backButton = (to: View) => (
    <button
      type="button"
      onClick={() => setView(to)}
      className="-ml-1 mb-1 flex items-center gap-0.5 text-sm font-medium
        text-muted-foreground active:opacity-70"
    >
      <ChevronLeft className="size-4" />
      Back
    </button>
  );

  // ---------- borrower list ----------
  if (view === "borrowers") {
    const list = suggestBorrowers(
      borrowers,
      query,
      isRelease ? [] : mentions.map((m) => m.id),
      BORROWER_LIST_LIMIT,
    );
    return (
      <div className="px-5 pt-2 pb-4">
        {backButton("compose")}
        <h2 className="text-lg font-semibold">Mention a borrower</h2>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search borrowers"
          aria-label="Search borrowers"
          className="mt-3 h-10 w-full rounded-lg border border-input
            bg-background px-3 text-base outline-none focus:border-ring
            focus:ring-3 focus:ring-ring/50"
        />
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {borrowers.length === 0 ? "Loading borrowers…" : "No match"}
          </p>
        ) : (
          <ul className="mt-2">
            {list.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => chooseBorrower(toComposerBorrower(b))}
                  className="flex w-full items-center gap-2 border-b
                    border-border py-2.5 text-left lowercase active:bg-muted"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOf(b.id) }}
                    aria-hidden="true"
                  />
                  {borrowerName(b)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ---------- manual account payment ----------
  if (view === "manual" && manualAccount && borrower) {
    const account = manualAccount;
    const check = manualPaymentCheck(account, payAmount);
    const done = recorded[account.id] !== undefined;
    const unsure = !!unconfirmed[account.id];
    const quick = manualQuickAmounts(account);
    const cap = quick[quick.length - 1];
    return (
      <>
        <div className="px-5 pt-2 pb-3">
          {backButton("dues")}
          <h2 className="text-lg font-semibold">Add payment</h2>
          <p className="text-sm text-muted-foreground">
            <span className="lowercase">{borrower.name}</span> · manual{" "}
            {account.rolling ? "rolling" : "flat"} {kindName(account.type)}
            {account.release_date
              ? ` released ${formatShortDate(account.release_date)}`
              : ""}
          </p>
          <div className="mt-3 rounded-2xl bg-muted/40 p-3">
            <AccountSummaryHeader
              summary={manualSummary(
                account,
                manualSummaryLeft(account, payAmount),
              )}
              pending={{
                ...NO_PENDING,
                paidAmount: check.canSave ? (check.amount ?? 0) : 0,
              }}
            />
          </div>
          {account.rolling && (
            <p className="mt-2 text-xs text-muted-foreground">
              Rolling account: what&apos;s left of the open schedule rolls into
              a new one with interest.
            </p>
          )}
          <div className="mt-3">
            <span className="mb-1 block text-sm font-medium">Amount paid</span>
            <AmountInput
              value={payAmount}
              onChange={setPayAmount}
              label="Amount paid"
              invalid={!!check.error}
            />
            {(check.error || check.hint) && (
              <p
                className={cn(
                  "mt-1.5 text-xs tabular-nums",
                  check.error ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {check.error ?? check.hint}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quick.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={check.amount === n}
                  onClick={() => setPayAmount(String(n))}
                  className={cn(
                    `rounded-full border px-3 py-1.5 text-sm font-medium
                    tabular-nums transition-colors active:scale-95`,
                    check.amount === n
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {n === cap ? `All ${peso(n)}` : peso(n)}
                </button>
              ))}
            </div>
          </div>
          <label className="mt-3 block text-sm font-medium">
            Payment date
            <input
              type="date"
              value={payDate}
              onChange={(e) => e.target.value && setPayDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-input
                bg-background px-3 text-base outline-none focus:border-ring
                focus:ring-3 focus:ring-ring/50"
            />
          </label>
          {unsure && (
            <p
              className="mt-3 text-sm font-medium text-amber-600
                dark:text-amber-400"
              role="alert"
            >
              {MANUAL_UNCONFIRMED}. It may already be recorded.
            </p>
          )}
        </div>
        <SheetFooter>
          <Button
            size="lg"
            disabled={!check.canSave || paying || disabled || done}
            onClick={() => void recordPayment(account)}
            className="h-12 w-full text-base"
          >
            {done
              ? "Payment recorded"
              : paying
                ? "Saving…"
                : unsure
                  ? "Record it again anyway"
                  : check.canSave && check.amount !== null
                    ? `Add payment · ${peso(check.amount)}`
                    : "Add payment"}
          </Button>
        </SheetFooter>
      </>
    );
  }

  // ---------- next dues ----------
  if (view === "dues" && borrower) {
    const { offered, alreadyListed } = offer;
    const manualAccounts = dues.status === "ready" ? dues.manualAccounts : [];
    const chosen = offered.filter((o) => selection.has(o.id));
    const allOn = offered.length > 0 && chosen.length === offered.length;
    const step = duesStepButton(lines, offered, selection);
    return (
      <>
        <div className="px-5 pt-2 pb-3">
          {backButton("compose")}
          <h2 className="text-lg font-semibold">Next dues</h2>
          <p className="text-sm text-muted-foreground">
            <span className="lowercase">{borrower.name}</span>
            {alreadyListed > 0 && ` · ${alreadyListed} already on the list`}
          </p>

          {dues.status !== "ready" ? (
            <div className="mt-3 space-y-2" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-muted/60"
                />
              ))}
            </div>
          ) : offered.length === 0 && manualAccounts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {alreadyListed > 0
                ? "Everything due is already on the list."
                : "No pending collections"}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {offered.length > 0 && (
                <li>
                  <DueToggle
                    on={allOn}
                    onToggle={() =>
                      setSelection(
                        allOn ? new Set() : new Set(offered.map((o) => o.id)),
                      )
                    }
                    title="Select all"
                    amount={linesTotal(offered)}
                  />
                </li>
              )}
              {offered.map((d) => (
                <li key={d.id}>
                  <DueToggle
                    on={selection.has(d.id)}
                    onToggle={() =>
                      setSelection((prev) => {
                        const next = new Set(prev);
                        if (next.has(d.id)) next.delete(d.id);
                        else next.add(d.id);
                        return next;
                      })
                    }
                    title={kindName(d.type)}
                    subtitle={formatShortDate(d.due_date).toLowerCase()}
                    amount={d.amount}
                    profit={d.profit}
                  />
                </li>
              ))}
            </ul>
          )}

          {manualAccounts.map((account) => {
            const paidHere = recorded[account.id];
            return (
              <div
                key={account.id}
                className="mt-3 rounded-2xl border border-border bg-background
                  p-3"
              >
                <p
                  className="mb-2 text-xs font-semibold tracking-wider
                    text-muted-foreground uppercase"
                >
                  Manual account
                </p>
                <AccountSummaryHeader
                  summary={manualSummary(account)}
                  pending={NO_PENDING}
                />
                {paidHere !== undefined ? (
                  <p
                    className="mt-3 flex items-center gap-1.5 text-sm
                      font-medium text-emerald-700 dark:text-emerald-300"
                  >
                    <Check className="size-4" />
                    {peso(paidHere)}{" "}
                    {queuedHere[account.id]
                      ? "payment saved offline · added to the list"
                      : "payment recorded · added to the list"}
                  </p>
                ) : (
                  <>
                    {unconfirmed[account.id] && (
                      <p
                        className="mt-3 text-sm text-amber-600
                          dark:text-amber-400"
                      >
                        {MANUAL_UNCONFIRMED}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="mt-3 h-10 w-full"
                      disabled={disabled}
                      onClick={() => {
                        setManualAccount(account);
                        setPayAmount("");
                        setView("manual");
                      }}
                    >
                      Add payment
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <SheetFooter>
          <Button
            size="lg"
            disabled={!step.enabled || disabled}
            onClick={() => {
              setLines(applyDuesSelection(lines, offered, selection));
              setView("compose");
            }}
            className="h-12 w-full text-base"
          >
            {step.label}
          </Button>
        </SheetFooter>
      </>
    );
  }

  // ---------- compose ----------
  const isToday = date === todayDateValue();
  const title = edit ? "Edit item" : `Add to ${isToday ? "today" : "this day"}`;
  const subtitle = edit
    ? (borrower?.name ?? "")
    : isRelease
      ? "Release"
      : "Collect";
  const buttonLabel =
    plan.ok && plan.action === "close"
      ? "Done"
      : isRelease
        ? "Add release"
        : edit
          ? "Save changes"
          : lines.length > 0
            ? // One row, however many dues it links.
              `Add item · ${lines.length} due${lines.length === 1 ? "" : "s"}`
            : "Add item";
  const linkedBorrower = !!(edit && borrower && onOpenBorrower);
  const placeholder = isRelease
    ? borrower
      ? "10,000 - 10 months for 110426"
      : "Start with @ to pick the borrower"
    : edit
      ? "Add a note"
      : "Type a note, @ for a borrower, /next for dues";

  return (
    <>
      <div className="px-5 pt-2 pb-3">
        <h2 className="text-lg font-semibold">
          {title}
          {subtitle && !linkedBorrower && (
            <span
              className="ml-1 text-sm font-normal text-muted-foreground
                lowercase"
            >
              · {subtitle}
            </span>
          )}
        </h2>
        {linkedBorrower && (
          <button
            type="button"
            onClick={onOpenBorrower}
            aria-label={`${subtitle}, open borrower page`}
            className="-my-1 inline-flex min-h-11 max-w-full items-center gap-1
              text-sm text-muted-foreground lowercase active:opacity-70"
          >
            <span className="truncate">{subtitle}</span>
            <ChevronRight className="size-4 shrink-0" />
          </button>
        )}

        <div
          className="mt-3 rounded-xl border border-border bg-background p-3
            focus-within:border-ring focus-within:ring-3
            focus-within:ring-ring/50"
        >
          {(mentions.length > 0 ||
            lines.length > 0 ||
            recordedLines.length > 0) && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {mentions.map((m) => {
                const color = colorOf(m.id);
                const removable = canMention;
                return (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 rounded-md border
                      px-2 py-1 text-sm font-semibold lowercase"
                    style={{
                      backgroundColor: `${color}24`,
                      borderColor: `${color}80`,
                    }}
                  >
                    {m.name}
                    {removable && (
                      <button
                        type="button"
                        onClick={() => dropMention(m.id)}
                        disabled={disabled}
                        aria-label={`Remove ${m.name}`}
                        className="-mr-1 rounded p-0.5 text-muted-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </span>
                );
              })}
              {recordedLines.map((l) => (
                // Recorded and listed as its own row: it stays, and isn't
                // part of what the button adds.
                <span
                  key={`paid-${l.id}`}
                  className="inline-flex items-center gap-1 rounded-full
                    bg-emerald-500/10 px-2.5 py-1 text-xs font-medium
                    text-emerald-700 tabular-nums dark:text-emerald-300"
                >
                  <Check className="size-3" strokeWidth={3} />
                  {chipText(l)}
                </span>
              ))}
              {lines.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 rounded-full
                    bg-muted px-2.5 py-1 text-xs font-medium tabular-nums"
                >
                  {chipText(l)}
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((x) => x.id !== l.id))
                    }
                    disabled={disabled}
                    aria-label={`Remove ${chipText(l)}`}
                    className="-mr-1 rounded-full p-0.5 text-muted-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={textRef}
            data-tour="add-note"
            rows={2}
            value={text}
            disabled={disabled}
            onChange={(e) => onText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              if (suggestions.length > 0) {
                e.preventDefault();
                chooseBorrower(toComposerBorrower(suggestions[0]));
              }
            }}
            placeholder={placeholder}
            aria-label={isRelease ? "Release note" : "Note"}
            className="block w-full resize-none bg-transparent text-base
              outline-none placeholder:text-muted-foreground
              disabled:opacity-60"
          />
          {lines.length > 1 && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              Total {peso(linesTotal(lines))}
            </p>
          )}
          {!edit && !isRelease && mentions.length > 1 && borrower && (
            <p className="mt-2 text-xs text-muted-foreground">
              Dues and /next use{" "}
              <span className="lowercase">{borrower.name}</span>
            </p>
          )}
        </div>

        {suggestions.length > 0 && (
          <ul
            className="mt-2 overflow-hidden rounded-xl border border-border
              bg-card"
            aria-label="Borrower suggestions"
          >
            {suggestions.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => chooseBorrower(toComposerBorrower(b))}
                  className="flex w-full items-center gap-2 border-b
                    border-border px-3 py-2.5 text-left text-sm lowercase
                    last:border-b-0 active:bg-muted"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOf(b.id) }}
                    aria-hidden="true"
                  />
                  {borrowerName(b)}
                </button>
              </li>
            ))}
          </ul>
        )}

        {hint && (
          <p
            className="mt-2 text-sm text-amber-600 dark:text-amber-400"
            role="status"
          >
            {hint}
          </p>
        )}
        {release?.parsed ? (
          <p className="mt-2 text-sm text-muted-foreground" role="status">
            {releaseReadBack(release.parsed)}
          </p>
        ) : isRelease && borrower && text.trim() ? (
          <p className="mt-2 text-sm text-muted-foreground" role="status">
            Can&apos;t read an amount yet
          </p>
        ) : null}
        {isRelease && !api.releasedId && !api.loading && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            There&apos;s no “released” category to add it to.
          </p>
        )}
        {recordedLines.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {recordedLines.length === 1
              ? "The payment is recorded and on the list as its own paid row."
              : "The payments are recorded and on the list as their own paid rows."}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {canMention && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setQuery("");
                setView("borrowers");
              }}
              className="flex h-10 items-center gap-1.5 rounded-full border
                border-border px-4 text-sm font-medium active:bg-muted
                disabled:opacity-50"
            >
              @ Borrower
            </button>
          )}
          {!isRelease && (
            <button
              type="button"
              disabled={disabled}
              onClick={openDues}
              className="flex h-10 items-center gap-1.5 rounded-full border
                border-border px-4 text-sm font-medium active:bg-muted
                disabled:opacity-50"
            >
              ₱ Next dues
            </button>
          )}
        </div>
      </div>

      <SheetFooter>
        <Button
          size="lg"
          disabled={!plan.ok || disabled}
          onClick={submit}
          className="h-12 w-full text-base"
        >
          {disabled ? "Loading…" : buttonLabel}
        </Button>
      </SheetFooter>
    </>
  );
}

/** One row of the dues step: a checkbox, what it is, the amount. */
function DueToggle({
  on,
  onToggle,
  title,
  subtitle,
  amount,
  profit,
}: {
  on: boolean;
  onToggle(): void;
  title: string;
  subtitle?: string;
  amount: number;
  /** What this due earns once paid, when known. */
  profit?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`${title}${subtitle ? `, ${subtitle}` : ""}, ${peso(amount)}`}
      onClick={onToggle}
      className={cn(
        `flex w-full items-center gap-3 rounded-xl border p-3 text-left
        transition-colors`,
        on ? "border-primary/40 bg-primary/5" : "border-border bg-background",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40",
        )}
      >
        {on && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium first-letter:uppercase">
          {title}
        </span>
        {subtitle && (
          <span className="block text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
        <ProfitText amount={profit} className="block text-xs" />
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {peso(amount)}
      </span>
    </button>
  );
}
