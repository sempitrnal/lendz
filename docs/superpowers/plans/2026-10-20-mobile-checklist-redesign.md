# Mobile Checklist Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the mobile-first daily checklist at `/daily-checklist/v2`, a replacement for `DailyNotesWidget` with Collect and Release tabs, one-tap pay, swipe actions, pay and edit sheets, an `@` and `/next` composer, populate due, date navigation, and a create-account sheet.

**Architecture:** Testable logic goes in `lib/checklist/*` (vitest). Side effects go in three hooks or functions (items data layer, payment recording, manual payment). UI lives in `components/dashboard/checklist-v2/`. The old widget keeps its own data layer untouched until the final cleanup task, and both screens read and write the same `daily_checklist_items` rows in the same label format.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, framer-motion (swipe, sheets), Supabase client, sonner, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-mobile-checklist-redesign-design.md`. Reference prototype: `components/mockups/checklist-mockup.tsx` (read it for layout and behaviour; never import from it).

## Global Constraints

- No database migration and no server-action changes. Tables, the label format (`[name](/borrowers/<id>)`, `#badge:date:<iso>|<scheduleId>`, `#badge:type:<loan|cash_advance>`) and the `/api/checklist/due` route stay as they are.
- `AGENTS.md`: this Next.js has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (routes, client/server boundaries).
- New route: `/daily-checklist/v2`. It must be added to `STATIC_ROUTES` in `components/offline-sync-manager.tsx` so it works offline.
- Carry-over window is 7 days (`CARRY_OVER_DAYS = 7`, `/api/checklist/due?date=…&back=7`).
- Toast Undo durations: 6000 ms for pay, edit payment, remove, clear, mark all paid; 8000 ms for populate. Offline sync toast: "Synced N offline changes." (singular: "Synced 1 offline change.").
- Exact strings: "Nothing new to add — everyone due or carried over is already listed", "Added N borrowers" ("Added 1 borrower"), "Marked N collections paid" ("Marked 1 collection paid"), "Mention a borrower first (@name)", "Offline · showing saved data", "Offline · N changes waiting" ("Offline · 1 change waiting"), "Reads as ₱10,000 loan · 10 months · first payment Nov 4, 2026".
- Tap versus swipe: a tap whose pointer moved more than 8 px is a swipe. Rows use `touch-action: pan-y` and drag direction lock.
- Every sheet opens from a clean state (remount its content on each open) and is capped at `88dvh` with scrolling; its primary button is sticky.
- UI chrome is sentence case; borrower names are shown lowercase.
- Paying more than is owed clamps to what is left.
- Tests: vitest only runs `lib/**/*.test.ts` (`vitest.config.ts`). Anything that needs a test lives under `lib/checklist/`. Run one file with `npx vitest run lib/checklist/<name>.test.ts`, everything with `npm test`, types with `npx tsc --noEmit -p .`, lint with `npx eslint <changed files>` (some existing files already have lint errors; add none).
- Do not modify `components/dashboard/daily-notes-widget.tsx` before Task 19, and never import from `components/mockups/`.

## Review Focus

1. A linked schedule that isn't in the offline cache: the row must follow the tick instead of showing wrong amounts (Task 1).
2. Notes that contain `₱` amounts, markdown links or the text `/next` must survive compose then parse unchanged (Task 3).
3. Populate must not duplicate: a schedule already listed under another row is skipped, and a plain-note row for a borrower must not block that borrower's collection row (Task 4).
4. A slow load for the previous day must never overwrite the day now showing (Task 6).
5. Payment amounts: more than owed clamps, zero, negative and non-numeric are ignored, and a "paid" choice on an already paid schedule does nothing (Task 5).

## File Structure

| File | Responsibility |
|---|---|
| `lib/checklist/row-state.ts` | `RowView`: line states, left, late days, carried, from an item plus cached schedules |
| `lib/checklist/list-view.ts` | Filters, counts, settled-last sort, list totals |
| `lib/checklist/categories.ts` | Which category is Collect/Release, which tab an item belongs to |
| `lib/checklist/release-items.ts` | `ReleaseRowView` from an item via `parseReleasedLabel` |
| `lib/checklist/composer.ts` | `@`/`/next` token helpers, compose and parse labels, set a note |
| `lib/checklist/populate.ts` | Which due groups become new rows |
| `lib/checklist/next-amounts.ts` | Borrower dues and manual accounts for `/next` |
| `lib/checklist/payment-plan.ts` | Turns per-schedule choices into the calls to make |
| `lib/checklist/manual-payment.ts` | Records a payment on a manual account |
| `lib/checklist/realtime.ts`, `load-sequence.ts` | Echo check for realtime events; stale-load guard |
| `components/dashboard/checklist/use-record-payments.ts` | Optimistic payment recording shared by the old dialog and the new sheets |
| `components/dashboard/checklist-v2/use-checklist-items.ts` | Day data: load, cache, realtime, outbox reload, item writes |
| `components/dashboard/checklist-v2/*.tsx` | `sheet`, `checklist-screen`, `header`, `collect-list`, `collect-row`, `pay-sheet`, `edit-payments-sheet`, `row-sheets`, `add-sheet`, `list-menu-sheets`, `release-list`, `create-account-sheet` |
| `app/(dashboard)/daily-checklist/v2/page.tsx` | The route |

---

### Task 1: Row state and list rules

**Files:**
- Create: `lib/checklist/row-state.ts`, `lib/checklist/list-view.ts`
- Test: `lib/checklist/row-state.test.ts`, `lib/checklist/list-view.test.ts`

**Interfaces:**
- Consumes: `collectionRowModel`, `CollectionRowModel`, `CollectionRowLine`, `buildDueLabel` (`lib/checklist/labels.ts`); `ScheduleDialogRow` (`lib/checklist/schedule-cache.ts`); `remainingOnInstallment` (`lib/payment-schedule/schedule-balances.ts`); `DailyChecklistItem` (`lib/checklist/types.ts`).
- Produces:
  ```ts
  export type LineState = "paid" | "partial" | "unpaid";
  export type RowLine = CollectionRowLine & { state: LineState; paid: number; left: number; overdue: boolean };
  export type RowStatus = "paid" | "partial" | "unpaid";
  export type RowView = {
    item: DailyChecklistItem; model: CollectionRowModel | null; lines: RowLine[];
    status: RowStatus; left: number; total: number; lateDays: number;
    dueOnDay: boolean; carried: boolean;
  };
  export function buildRowView(item: DailyChecklistItem, schedules?: Map<string, ScheduleDialogRow>): RowView;
  export type ChecklistFilter = "all" | "overdue" | "today" | "paid";
  export function matchesFilter(row: RowView, filter: ChecklistFilter): boolean;
  export function filterCounts(rows: RowView[]): Record<ChecklistFilter, number>;
  export function sortSettledLast(rows: RowView[]): RowView[];
  export function summarizeRows(rows: RowView[]): { left: number; due: number; collected: number; done: number; count: number };
  ```

- [ ] **Step 1: Write the failing tests.** Build labels with `buildDueLabel({ borrower_id: "b1", name: "ana", items: [...] })`.
  - `"a line takes its state from its saved schedule"`: schedule `status: "paid"` gives `state "paid", left 0`; `amount_paid > 0` and `remaining_amount > 0` gives `"partial"` with `left` equal to the remaining; no payment gives `"unpaid", left = amount`.
  - `"a line with no saved schedule follows the tick"` (Review Focus 1): unticked item gives `status "unpaid", left = total`; ticked gives `status "paid", left 0`.
  - `"status is partial when some lines are paid and others are not"` for a two-line row.
  - `"a line is overdue only when its schedule says overdue"`: past due with schedule status `"pending"` gives `overdue false`; status `"overdue"` gives `true`; past due with no saved schedule gives `true`. `lateDays` is the largest `daysOverdue` among overdue lines.
  - `"carried is true only when every line is due before the checklist date"`, and `dueOnDay` is true when an unsettled line is due on `checklist_date`.
  - `"a label without collection lines is a plain note"`: `model null, lines [], total 0, left 0`, status follows the tick.
  - list-view: `matchesFilter` for all four (`overdue`: not paid and `lateDays > 0`; `today`: not paid and `dueOnDay`; `paid`: status paid); `filterCounts`; `sortSettledLast` keeps the original order apart from moving paid rows last; `summarizeRows` returns `due` (sum of totals), `left`, `collected = due - left` rounded to cents, `done` (paid rows), `count`.
- [ ] **Step 2: Run** `npx vitest run lib/checklist/row-state.test.ts lib/checklist/list-view.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both files to the signatures above. Rules copy `CollectionLabel` and `summarizeChecklist`: with a schedule row, `left = min(line.amount, remainingOnInstallment(row))`, `paid = line.amount - left`; `state` is `"paid"` when the row's status is paid, `"partial"` when it has an `amount_paid > 0`, else `"unpaid"`. Without one, follow the tick. `overdue = state !== "paid" && line.daysOverdue > 0 && (row ? row.status === "overdue" : true)`.
- [ ] **Step 4: Run** the same command plus `npx tsc --noEmit -p .`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit**
  ```bash
  git add lib/checklist/row-state.ts lib/checklist/list-view.ts lib/checklist/row-state.test.ts lib/checklist/list-view.test.ts
  git commit -m "feat: row state and list filters for the checklist redesign"
  ```

### Task 2: Categories and release rows

**Files:**
- Create: `lib/checklist/categories.ts`, `lib/checklist/release-items.ts`
- Test: `lib/checklist/categories.test.ts`, `lib/checklist/release-items.test.ts`

**Interfaces:**
- Consumes: `ChecklistCategory`, `DailyChecklistItem`; `parseReleasedLabel`, `ParsedReleasedLabel` (`lib/checklist/released.ts`); `extractBorrowerMention` (`labels.ts`).
- Produces:
  ```ts
  export type ChecklistTab = "collect" | "release";
  export function resolveCategoryIds(categories: ChecklistCategory[]): { releasedId: string | null; collectId: string | null };
  export function tabOf(item: DailyChecklistItem, releasedId: string | null): ChecklistTab;
  export type ReleaseRowView = { item: DailyChecklistItem; parsed: ParsedReleasedLabel | null; name: string; typed: string; created: boolean };
  export function buildReleaseView(item: DailyChecklistItem): ReleaseRowView;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `resolveCategoryIds`: `[received, released]` gives both ids (name match is trimmed and case-insensitive); only `["to do"]` gives `releasedId null, collectId` = that id; the lowest `sort_order` wins when there is no "received"; empty gives both `null`.
  - `tabOf`: `category_id === releasedId` is `"release"`; `null` category or any other is `"collect"`; with `releasedId null` everything is `"collect"`.
  - `buildReleaseView` for `[carla mendoza](/borrowers/b1) 10,000 - 10 months for 110426` with `checklist_date "2026-10-19"`: `parsed.initialValues` has `principal_amount 10000`, `term_months 10`, `first_payment_date "2026-11-04"`; `name "carla mendoza"`; `typed "carla mendoza 10,000 - 10 months for 110426"`; `created` mirrors `is_checked`. A label with a mention but no amount gives `parsed null`.
- [ ] **Step 2: Run** `npx vitest run lib/checklist/categories.test.ts lib/checklist/release-items.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files. The Collect category used for new items is `collectId`: the category named "received", else the first non-released by `sort_order`, else `null`. (This rule is an implementation decision the spec does not state; flag it in the PR description.)
- [ ] **Step 4: Run** the command. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add lib/checklist/categories.ts lib/checklist/release-items.ts lib/checklist/categories.test.ts lib/checklist/release-items.test.ts
  git commit -m "feat: collect and release tab rules for the checklist"
  ```

### Task 3: Composer helpers

**Files:**
- Create: `lib/checklist/composer.ts`
- Test: `lib/checklist/composer.test.ts`

**Interfaces:**
- Consumes: `buildDueLabel`, `collectionRowModel`, `extractBorrowerMention`, `formatShortDate` (`labels.ts`); `DueChecklistItem` (`types.ts`).
- Produces:
  ```ts
  export type ComposerBorrower = { id: string; name: string };
  export function atQuery(text: string): string | null;
  export function removeAtToken(text: string): string;
  export function stripNextToken(text: string): { text: string; hadNext: boolean };
  export function composeLabel(input: { borrower: ComposerBorrower | null; others: ComposerBorrower[]; lines: DueChecklistItem[]; note: string }): string;
  export function labelParts(label: string, checklistDate: string): { borrower: ComposerBorrower | null; lines: DueChecklistItem[]; note: string };
  export function withNote(label: string, checklistDate: string, note: string): string;
  ```
  `composeLabel` puts the active borrower's mention first (so `extractBorrowerMention` returns them), then the `buildDueLabel` block when there are lines, then the note, then `with [x](/borrowers/id), …` for `others`. With no lines it is the mention followed by the note on one line.

- [ ] **Step 1: Write the failing tests.**
  - `atQuery("call @ma")` is `"ma"`, `atQuery("call ma")` is `null`, `atQuery("@")` is `""`; `removeAtToken("call @ma")` is `"call "`; `stripNextToken("pay /next now")` is `{ text: "pay now", hadNext: true }`.
  - `"compose then parse returns the same parts"`: lines `[{ id: "s1", due_date: "2026-10-19", amount: 1850, type: "loan" }, { id: "s2", due_date: "2026-10-19", amount: 742.5, type: "cash_advance" }]` plus note `"promised the 22nd"` round-trips through `labelParts`, and `collectionRowModel(label, "2026-10-19")?.total` is `2592.5`.
  - Review Focus 2: notes `"paid ₱500 cash"`, `"see [bob](/borrowers/x) first"` and `"/next week"` each come back identical from `labelParts` and add no extra collection lines.
  - `"others are written as mentions after the note"`: the label ends `with [carlo](/borrowers/c1)` and `extractBorrowerMention` still returns the active borrower.
  - `withNote` replaces only the note: the mention and lines are unchanged, an empty note removes it.
- [ ] **Step 2: Run** `npx vitest run lib/checklist/composer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** to the signatures; reuse `buildDueLabel` for the block (it lowercases the name).
- [ ] **Step 4: Run** the command. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add lib/checklist/composer.ts lib/checklist/composer.test.ts
  git commit -m "feat: composer helpers for the checklist add sheet"
  ```

### Task 4: Populate selection and `/next` amounts

**Files:**
- Create: `lib/checklist/populate.ts`, `lib/checklist/next-amounts.ts`
- Test: `lib/checklist/populate.test.ts`, `lib/checklist/next-amounts.test.ts`

**Interfaces:**
- Consumes: `buildDueLabel`, `extractScheduleRefs`, `extractBorrowerMention`, `BorrowerNextData`, `NextCollectionItem`, `ManualAccount` (`labels.ts`); `DueChecklistGroup`; `overdueCutoffDateValue` (`dates.ts`).
- Produces:
  ```ts
  export function selectPopulateLabels(groups: DueChecklistGroup[], existing: { label: string }[]): string[];
  export type BorrowerDetailsPayload = { accounts: Array<Record<string, unknown>>; metrics: Record<string, Record<string, unknown>> };
  export function mapBorrowerNextAmounts(data: BorrowerDetailsPayload, overdueCutoff: string): BorrowerNextData;
  export async function fetchBorrowerNextAmounts(borrowerId: string): Promise<BorrowerNextData>;
  ```

- [ ] **Step 1: Write the failing tests.**
  - Populate: a borrower who already has a row with schedule refs is skipped; a schedule id already listed under another row is dropped, and a group left with no items disappears; Review Focus 3: a plain-note row (no schedule refs) that mentions a borrower does not block that borrower; result order follows `groups`, each entry is `buildDueLabel(group)`.
  - Next amounts: the payload mapping moved out of the old widget's `getBorrowerNextAmounts`: only `loan` and `cash_advance` accounts; a pending manual account is skipped; items with `amount <= 0` or no date are dropped; items sort overdue-first (due before `overdueCutoff`), then by date, then by type; a manual account with `amountLeftToPay > 0` appears in `manualAccounts`, and a rolling one carries `rolling.open` from the first collection with `amount > 0`.
- [ ] **Step 2: Run** `npx vitest run lib/checklist/populate.test.ts lib/checklist/next-amounts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `selectPopulateLabels` is the filter chain in the old `populateDue` (`daily-notes-widget.tsx`, `listedBorrowers` and `already`). `mapBorrowerNextAmounts` moves the body of `getBorrowerNextAmounts` unchanged; `fetchBorrowerNextAmounts` is the `fetch('/api/borrowers/${id}/details')` wrapper that returns `{ items: [], manualAccounts: [] }` on any failure.
- [ ] **Step 4: Run** the command. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add lib/checklist/populate.ts lib/checklist/next-amounts.ts lib/checklist/populate.test.ts lib/checklist/next-amounts.test.ts
  git commit -m "feat: populate selection and next-amounts helpers"
  ```

### Task 5: Payment plan

**Files:**
- Create: `lib/checklist/payment-plan.ts`
- Test: `lib/checklist/payment-plan.test.ts`

**Interfaces:**
- Consumes: `ScheduleDialogRow`; `remainingOnInstallment`.
- Produces:
  ```ts
  export type ScheduleChoice = { status: "paid" | "partial" | "undo" | null; amount: string };
  export type PaymentPlan = {
    payments: { scheduleId: string; amount: number }[];
    paidIds: string[];
    partials: { id: string; amount: number }[];
    undoCalls: { accountId: string; scheduleId: string; status: "pending" | "overdue" }[];
  };
  export function buildPaymentPlan(rows: ScheduleDialogRow[], choices: Record<string, ScheduleChoice>, overdueCutoff: string): PaymentPlan;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `"paid pays what is left"`: choice `paid` on a schedule with 1,500 left gives `payments [{ scheduleId, amount: 1500 }]` and `paidIds [id]`.
  - Review Focus 5: `partial` with `"99999"` on 1,500 left clamps to `1500`; `"0"`, `"-5"`, `"abc"` and `""` produce nothing; `paid` on a schedule whose status is `"paid"` produces nothing.
  - `"undo resets to pending, or overdue once past due"`: `due_date` before `overdueCutoff` gives `"overdue"`, otherwise `"pending"`; `undoCalls` carries the account id.
  - `"rows with no choice are ignored"`.
- [ ] **Step 2: Run** `npx vitest run lib/checklist/payment-plan.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** It is the pure core of `ScheduleCheckDialog.handleConfirm` (`chosenPayments`, `paidIds`, `partials`, `undoCalls`), plus the clamp.
- [ ] **Step 4: Run** the command. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add lib/checklist/payment-plan.ts lib/checklist/payment-plan.test.ts
  git commit -m "feat: pure payment plan for checklist payments"
  ```

### Task 6: Realtime echo check and stale-load guard

**Files:**
- Create: `lib/checklist/realtime.ts`, `lib/checklist/load-sequence.ts`
- Test: `lib/checklist/realtime.test.ts`, `lib/checklist/load-sequence.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ItemChangePayload = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Partial<DailyChecklistItem> & { id?: string }; old: { id?: string } };
  export function isEchoOfLocalState(payload: ItemChangePayload, current: DailyChecklistItem[]): boolean;
  export function createLoadSequence(): { next(): number; isCurrent(seq: number): boolean };
  ```

- [ ] **Step 1: Write the failing tests.** Echo: a DELETE for an id no longer shown is an echo; an UPDATE whose `label`, `is_checked`, `sort_order` (numeric compare) and `category_id` (null equals undefined) already match is an echo; a changed label is not; an INSERT for an unknown id is not. Sequence: after `a = next()` and `b = next()`, `isCurrent(a)` is false and `isCurrent(b)` is true (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run lib/checklist/realtime.test.ts lib/checklist/load-sequence.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `isEchoOfLocalState` is the function of the same name in `daily-notes-widget.tsx` (move the code, export it).
- [ ] **Step 4: Run** the command. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add lib/checklist/realtime.ts lib/checklist/load-sequence.ts lib/checklist/realtime.test.ts lib/checklist/load-sequence.test.ts
  git commit -m "feat: realtime echo check and stale-load guard"
  ```

### Task 7: `useRecordPayments`, shared with the old dialog

**Files:**
- Create: `components/dashboard/checklist/use-record-payments.ts`
- Modify: `components/dashboard/checklist/payment-dialogs.tsx` (`ScheduleChoice` type near line 52; `chosenPayments`, `undoRows` and `handleConfirm` at about lines 398-496)

**Interfaces:**
- Consumes: `buildPaymentPlan`, `PaymentPlan`, `ScheduleChoice` (Task 5); `applyPaymentsToCache`, `undoPaymentsInCache`, `refreshCachedAccounts`, `actionWasQueued` (`schedule-cache.ts`); `markSchedulesPaidAction`, `applyPartialPaymentAction`, `updateScheduleStatusAction` (`lib/actions/schedules.ts`); `getPendingOutboxCount`; `useInvalidateBorrowerDetails`; `ACCOUNT_SUMMARIES_KEY`.
- Produces:
  ```ts
  export type RecordPaymentsInput = {
    plan: PaymentPlan; accountIds: string[]; borrowerId: string | null; paymentDate: string;
    onApplied?: () => void;   // after the local result shows, before the server answers
    onFailed?: () => void;    // after a refusal, once the local result is put back
  };
  export function useRecordPayments(): (input: RecordPaymentsInput) => Promise<"saved" | "queued" | "failed">;
  ```

- [ ] **Step 1: Implement the hook** by moving the sequence in `ScheduleCheckDialog.handleConfirm` verbatim: read `getPendingOutboxCount()`, apply the plan to the cache (`undoPaymentsInCache` then `applyPaymentsToCache`), call `onApplied`, run the server calls (`markSchedulesPaidAction(paidIds, paymentDate)`, one `applyPartialPaymentAction` FormData `{scheduleId, paymentAmount, paymentDate}` per partial, one `updateScheduleStatusAction(accountId, FormData{scheduleId, status})` per undo), then `refreshCachedAccounts(accountIds)`, `invalidateBorrowerDetails(borrowerId)` and `queryClient.invalidateQueries({ queryKey: [ACCOUNT_SUMMARIES_KEY] })`. If a call throws and `actionWasQueued(queuedBefore)` is true return `"queued"`; otherwise refresh the caches, call `onFailed`, show the error toast "Couldn't save the payment — it has been undone" and return `"failed"`. The hook shows no success toast; callers do.
- [ ] **Step 2: Refactor `ScheduleCheckDialog`** to build its plan with `buildPaymentPlan(rows, choices, overdueCutoffDateValue())` and call the hook, keeping its own success toast and `onConfirmed` inside `onApplied`. Replace its local `ScheduleChoice` with the import.
- [ ] **Step 3: Verify** `npx tsc --noEmit -p .` and `npx eslint components/dashboard/checklist/payment-dialogs.tsx components/dashboard/checklist/use-record-payments.ts` show no new problems. In the browser on the OLD checklist (`/daily-checklist`), check: tick a collection row and choose Paid, the row ticks and the toast shows; choose Partial with an amount, it records; reopen a ticked row and Undo, the schedule returns to pending/overdue; turn the network off and repeat once, the change syncs after reconnecting.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add components/dashboard/checklist/use-record-payments.ts components/dashboard/checklist/payment-dialogs.tsx
  git commit -m "refactor: share payment recording between the dialog and the new sheets"
  ```

### Task 8: Manual payment function

**Files:**
- Create: `lib/checklist/manual-payment.ts`
- Test: `lib/checklist/manual-payment.test.ts`
- Modify: `components/dashboard/checklist/manual-payment-dialog.tsx` (`ManualPaymentBody.handleConfirm`, about lines 245-293)

**Interfaces:**
- Consumes: `addManualScheduleAction`, `applyPartialPaymentAction`; `ManualAccount`, `NextCollectionItem`.
- Produces:
  ```ts
  export type ManualPaymentResult =
    | { ok: true; schedule: NextCollectionItem; rolloverAmount: number }
    | { ok: false; error: string };
  export async function recordManualPayment(input: { account: ManualAccount; amount: number; paidDate: string }): Promise<ManualPaymentResult>;
  ```

- [ ] **Step 1: Write the failing tests** with `vi.mock("@/lib/actions/schedules")`.
  - Rolling account with `rolling.open = { id: "s1", due_date: "2026-10-20", amount: 2000 }` and amount 500: calls `applyPartialPaymentAction` once with FormData `scheduleId "s1"`, `paymentAmount "500"`, `paymentDate`; returns `ok true`, `schedule { id: "s1", due_date: "2026-10-20", amount: 500, type }`, `rolloverAmount 1500`.
  - Flat account: calls `addManualScheduleAction(account.id, { due_date: paidDate, amount_due: 500, status: "paid", paid_date: paidDate })`; returns the new id as `schedule.id`.
  - Flat account where the action returns no id: `{ ok: false, error }` with the action's error, or "Couldn't add the payment (offline?)" when it gave none.
  - A thrown action returns `{ ok: false, error: "Couldn't add the payment" }`.
- [ ] **Step 2: Run** `npx vitest run lib/checklist/manual-payment.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** by moving the two branches out of `handleConfirm` unchanged. The dialog keeps its toasts, `invalidateBorrowerDetails` and `onSaved`, and calls the function.
- [ ] **Step 4: Run** the command and `npx tsc --noEmit -p .`. Expected: PASS. In the browser on the old checklist, record one flat and one rolling manual payment through `/next` and confirm both still work.
- [ ] **Step 5: Commit**
  ```bash
  git add lib/checklist/manual-payment.ts lib/checklist/manual-payment.test.ts components/dashboard/checklist/manual-payment-dialog.tsx
  git commit -m "refactor: extract manual payment recording"
  ```

### Task 9: `useChecklistItems` data layer

**Files:**
- Create: `components/dashboard/checklist-v2/use-checklist-items.ts`

**Interfaces:**
- Consumes: `fetchChecklistItems`, `fetchChecklistCategories`, `readCachedItems`, `writeCachedItems`, `readCachedCategories`, `writeCachedCategories`, `wasQueuedOffline` (`offline-cache.ts`); `warmScheduleCache`; `getPendingOutboxCount`; `isEchoOfLocalState`, `createLoadSequence` (Task 6); `resolveCategoryIds` (Task 2); the `supabase` client.
- Produces:
  ```ts
  export type ChecklistItemsApi = {
    date: string; items: DailyChecklistItem[]; categories: ChecklistCategory[]; loading: boolean;
    releasedId: string | null; collectId: string | null;
    /** Item ids whose last write was queued offline and hasn't synced yet. */
    waitingIds: Set<string>;
    /** Item ids that just changed from elsewhere (another device or tab); cleared after about 2.5 s. */
    flashIds: Set<string>;
    addItems(rows: { label: string; categoryId: string | null; checked?: boolean }[]): Promise<DailyChecklistItem[]>;
    setLabel(id: string, label: string): void;
    setChecked(ids: string[], checked: boolean): void;
    removeItems(ids: string[]): DailyChecklistItem[];          // returns what was removed, for Undo
    restoreItems(rows: DailyChecklistItem[]): Promise<void>;
  };
  export function useChecklistItems(date: string): ChecklistItemsApi;
  ```

- [ ] **Step 1: Implement** by moving, not rewriting, the data logic of `DailyNotesWidget` (`daily-notes-widget.tsx` about lines 1100-1500): cached day shown first, no fetch while offline or while the outbox has pending writes, `fetchChecklistItems`, the load-sequence guard, `writeCachedItems` on every change, reload on `OUTBOX_RESULT` and `online`, the realtime channel `daily-checklist-items-${date}` with the echo check and a 300 ms debounced reload, the 30 s refetch after `visibilitychange`, and the optimistic insert, update and delete writes with `wasQueuedOffline`. Item sorting is `sort_order` then `created_at` descending. New rows get `sort_order = min(sort_order of that category) - n`. A write that is queued adds its ids to `waitingIds`; `OUTBOX_RESULT`, a successful reload or `online` clears them. A realtime reload that finds an already shown item changed, when the change did not come from this screen's own write, adds it to `flashIds` for about 2.5 s. The hook shows no toasts except the existing error toasts.
- [ ] **Step 2: Verify** with `npx tsc --noEmit -p .` and `npx eslint components/dashboard/checklist-v2/use-checklist-items.ts`. The behaviour is verified in Task 10 through the screen.
- [ ] **Step 3: Commit**
  ```bash
  git add components/dashboard/checklist-v2/use-checklist-items.ts
  git commit -m "feat: checklist day data hook for the redesign"
  ```

### Task 10: Route, sheet wrapper, header and a read-only list

**Files:**
- Create: `app/(dashboard)/daily-checklist/v2/page.tsx`, `components/dashboard/checklist-v2/checklist-screen.tsx`, `header.tsx`, `sheet.tsx`, `collect-list.tsx`
- Modify: `components/offline-sync-manager.tsx` (add `"/daily-checklist/v2"` to `STATIC_ROUTES`)

**Interfaces:**
- Consumes: `useChecklistItems` (Task 9); `buildRowView`, `filterCounts`, `summarizeRows`, `matchesFilter` (Task 1); `tabOf` (Task 2); `useCachedSchedules`; `shiftDateValue`, `todayDateValue`, `relativeDayLabel` (`dates.ts`); `groupByBorrowerCategory`, `useBorrowersSearch`.
- Produces: `Sheet` (`{ open: boolean; onClose(): void; children }`, a bottom sheet in the style of `components/bottom-nav.tsx`, content remounted per open via a counter key owned by the screen), `Header`, and a `CollectList` that renders groups and a plain row; later tasks add behaviour.

- [ ] **Step 1: Read** `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` and `05-server-and-client-components.md`.
- [ ] **Step 2: Implement** the page (a client screen under the dashboard layout), the header (date row with previous, the date as a button for the native date input, the relative chip, next, and "Back to today"; the total and progress bar; the sticky Collect and Release switch with counts; the filter chips with counts), `Sheet`, and a read-only Collect list: groups by `groupByBorrowerCategory`, the amber collapsible "carried over" section after today's groups, single-line rows per the spec table, and plain-note rows (no collection lines) as a tick, the label text and, later, the row menu. On wide screens the whole screen is a centred phone-width column (`mx-auto max-w-md`). Changing the day dismisses toasts and resets the filter. Release shows a placeholder until Task 16.
- [ ] **Step 3: Verify** at 375 px width, light and dark. For a day that has items, the total "left" equals the old checklist's "left to collect" for that day; previous/next day and the date picker load the right day; going offline and reloading still shows the saved day; opening the same day in a second tab and ticking an item there updates this tab within a few seconds.
- [ ] **Step 4: Commit**
  ```bash
  git add "app/(dashboard)/daily-checklist/v2" components/dashboard/checklist-v2 components/offline-sync-manager.tsx
  git commit -m "feat: checklist v2 route with header and read-only list"
  ```

### Task 11: Collect rows: pay controls and swipe

**Files:**
- Create: `components/dashboard/checklist-v2/collect-row.tsx`
- Modify: `collect-list.tsx`, `checklist-screen.tsx`

**Interfaces:**
- Consumes: `RowView` (Task 1); `useRecordPayments` (Task 7); `buildPaymentPlan` (Task 5); `useChecklistItems.setChecked`.
- Produces: `CollectRow({ row: RowView; waiting: boolean; highlight: boolean; swiped: boolean; onSwiped(open: boolean): void; onOpenPay(): void; onEditPayments(): void; onPartial(): void; onNote(): void; onMore(): void; onPayRow(): void; onExpandToggle(): void; expanded: boolean })`.

- [ ] **Step 1: Implement** the row per the spec's "A collection row" table. One open installment: check circle pays what is left through `useRecordPayments` with a plan from `buildPaymentPlan` (a `paid` choice for that schedule), ticks the item through `setChecked`, and shows an Undo toast (6000 ms) whose action runs an `undo` plan and unticks. Several open installments: "Pay N" pill opens the pay sheet; tapping the row expands inline with a check per installment and "Pay all ₱x". Paid rows show "paid · tap to edit" and open the edit-payments sheet. Swipe left reveals Partial (Payment on paid rows), Note and More (192 px total) with `framer-motion` drag, `touch-pan-y`, `dragDirectionLock`, and the 8 px tap-versus-swipe rule; opening one row closes the other. A plain-note row has a tick instead of a pay control (`setChecked`). "Pay N" opens the pay sheet first, never pays instantly (spec decision). The row passes `waiting` (cloud-upload icon) and `highlight` (primary tint that fades over 700 ms).
- [ ] **Step 2: Verify** at 375 px with real touch if possible (a phone on the same network can open `http://<mac-ip>:3000/daily-checklist/v2`; the dev server binds `0.0.0.0`): single pay then Undo; a two-installment row expands and pays one; a swipe never opens the pay sheet; vertical scrolling works while a finger is on a row; the check circle in a paid row opens the edit sheet.
- [ ] **Step 3: Commit**
  ```bash
  git add components/dashboard/checklist-v2
  git commit -m "feat: checklist v2 rows with one-tap pay and swipe actions"
  ```

### Task 12: Pay sheet and edit-payments sheet

**Files:**
- Create: `components/dashboard/checklist-v2/pay-sheet.tsx`, `edit-payments-sheet.tsx`
- Modify: `checklist-screen.tsx`

**Interfaces:**
- Consumes: `RowView`; `loadSchedules`, `loadAccountSummaries`, `AccountSummary`, `AccountSummaryHeader` (`payment-dialogs.tsx`, exported); `buildPaymentPlan`; `useRecordPayments`; `ScheduleChoice`.
- Produces: `PaySheet({ row: RowView; startPartial: boolean; onClose(): void; onEditRecorded(): void; onOpenBorrower(): void; onMore(): void })` and `EditPaymentsSheet({ row: RowView; onClose(): void; onOpenBorrower(): void })`.

- [ ] **Step 1: Implement `PaySheet`** per the spec: one block per account with `AccountSummaryHeader`, the open installments as checkable rows all ticked, "Pay a different amount" turning amounts into inputs, primary button "Record ₱x paid", an "Edit recorded payments" link when anything is already paid, the borrower name opening `/borrowers/<id>`, and a "More" link opening the row menu (the gesture-free path to Note, Edit item and Remove; the spec's open question 2). Choices become `ScheduleChoice` (`paid` for a full row, `partial` with the typed amount otherwise) and go through `buildPaymentPlan` and `useRecordPayments`. Fully paid after saving: tick the item; otherwise leave it as it is. Toast with Undo (6000 ms).
- [ ] **Step 2: Implement `EditPaymentsSheet`**: one card per installment with money recorded, an amount input, "Paid in full" and "Not paid" shortcuts; the button reads "Save · ₱x paid" or "Remove payment" when all go to zero, and is disabled until something changes. Saving builds an `undo` choice for each reduced schedule followed by a `partial` for the new amount, in one plan; it leaves the tick untouched unless nothing is paid any more (then untick).
- [ ] **Step 3: Verify** the spec's pay-sheet and edit-payments sections: untick one installment and pay the rest; type a partial higher than what is owed and see it clamp; remove a payment and see the row return to unpaid; offline pay shows the waiting icon.
- [ ] **Step 4: Commit**
  ```bash
  git add components/dashboard/checklist-v2
  git commit -m "feat: checklist v2 pay and edit-payment sheets"
  ```

### Task 13: Add sheet

**Files:**
- Create: `components/dashboard/checklist-v2/add-sheet.tsx`
- Modify: `checklist-screen.tsx`, `header.tsx` (the "+" button)

**Interfaces:**
- Consumes: `atQuery`, `removeAtToken`, `stripNextToken`, `composeLabel`, `labelParts` (Task 3); `fetchBorrowerNextAmounts` (Task 4); `recordManualPayment` (Task 8); `parseReleasedLabel`; `useBorrowersSearch`; `useChecklistItems.addItems/setLabel`.
- Produces: `AddSheet({ mode: "collect" | "release"; date: string; edit?: RowView; onClose(): void })`, which writes through the screen's `useChecklistItems`.

- [ ] **Step 1: Implement** the composer per the spec's "Add sheet": inline `@` suggestions (up to 4) and an "@ Borrower" button opening a searchable list; several coloured pills, dues use the last; "₱ Next dues" and a typed `/next` open an in-sheet step listing `fetchBorrowerNextAmounts(borrowerId).items` with "Select all" and checkboxes, coming back as chips, with the hint "Mention a borrower first (@name)" when none is mentioned; a "Manual account" card per `manualAccounts` entry with an "Add payment" step (amount, quick amounts including the full balance, date; rolling note) that calls `recordManualPayment` and turns into a green "paid" chip (the payment is saved at that moment, as in the old dialog; an error shows the toast and stays on the step). Submitting builds the label with `composeLabel` and inserts it in `collectId`; with no dues it adds a plain note item. Release mode: only "@ Borrower" and "Add release"; show the live "Reads as …" line from `parseReleasedLabel`; the button stays disabled until it parses; the item goes into `releasedId`. Edit mode (`edit` set): title "Edit item", no `@`, pre-filled chips and note from `labelParts`, "Save changes" calls `setLabel` with `composeLabel` and is disabled with no lines. Dues already on the day's list are not offered twice.
- [ ] **Step 2: Verify** against the prototype: `@nor` suggestion and pill; two mentions then `/next`; select two dues and add; a manual rolling account payment; Release entry "10,000 - 10 months for 110426" shows the read-back line and adds a release row; reopening the sheet after a submit starts empty. Parity with the old screen: an item added here opens and ticks correctly in `/daily-checklist`, and an item added in the old screen (a `/next` row, a free-text note, a release line) renders correctly here.
- [ ] **Step 3: Commit**
  ```bash
  git add components/dashboard/checklist-v2
  git commit -m "feat: checklist v2 add sheet with mentions, next dues and manual payments"
  ```

### Task 14: Row menu, note and remove

**Files:**
- Create: `components/dashboard/checklist-v2/row-sheets.tsx`
- Modify: `checklist-screen.tsx`

**Interfaces:**
- Consumes: `RowView`; `labelParts`, `withNote` (Task 3); `useChecklistItems.setLabel/removeItems/restoreItems`.
- Produces: `RowMenuSheet({ row; onEditItem(): void; onOpenBorrower(): void; onRemove(): void })` and `NoteSheet({ row; onClose(): void })`.

- [ ] **Step 1: Implement** `RowMenuSheet` (Edit item opens `AddSheet` in edit mode, Open borrower page, Remove from list) and `NoteSheet` (a textarea; saving calls `setLabel(item.id, withNote(label, date, note))`). Remove deletes the checklist item only, never payments, with the toast "<name> removed from the list" and Undo (6000 ms) that calls `restoreItems`. Wire the borrower name everywhere to `/borrowers/<id>`.
- [ ] **Step 2: Verify**: add and clear a note, the note icon shows on the row; Edit item adds a due and the row becomes "2 due"; Remove then Undo restores the same row (same id); the payments of a removed paid row remain on the account page.
- [ ] **Step 3: Commit**
  ```bash
  git add components/dashboard/checklist-v2
  git commit -m "feat: checklist v2 row menu, notes and remove"
  ```

### Task 15: List menu, populate and mark all paid

**Files:**
- Create: `components/dashboard/checklist-v2/list-menu-sheets.tsx`
- Modify: `checklist-screen.tsx`, `header.tsx` (the "⋯" button), `collect-list.tsx` (empty state)

**Interfaces:**
- Consumes: `selectPopulateLabels` (Task 4); `useChecklistItems.addItems/removeItems/restoreItems/setChecked`; `useRecordPayments`; `buildPaymentPlan`; `extractScheduleRefs`; `loadSchedules`.
- Produces: `ListMenuSheet({ unpaidCount; total; canUndoPopulate; … })` and `BulkPaidSheet({ rows: RowView[]; date: string; onClose(): void })`.

- [ ] **Step 1: Implement Populate due**: fetch `/api/checklist/due?date=<day>&back=7` (error text as in `fetchDueGroups`), `selectPopulateLabels(groups, items)`, insert the labels in `collectId`, toast "Added N borrowers" with Undo (8000 ms) or the "Nothing new to add — …" message. Undo populate deletes only rows still untouched (label unchanged and unticked) and reports "Removed N items (K kept — edited or ticked)" like the old `undoPopulate`. The same action is the empty-list button.
- [ ] **Step 2: Implement the menu and the bulk sheet**: the "⋯" sheet lists Populate due, Mark all paid (n), Undo populate (only right after a populate), Clear all (n; toast with Undo, 6000 ms), and a "Manage categories" link to `/daily-checklist/categories`. The bulk sheet loads the schedules of every unpaid row, shows the summary (borrowers, collections to mark paid, already paid when any, total) and a payment date, then marks them paid with `markSchedulesPaidAction` through the same cache updates as the old `BulkPaidDialog` and ticks the items; toast "Marked N collections paid" with Undo (6000 ms).
- [ ] **Step 3: Verify**: Clear all then Populate fills the day; a second Populate reports nothing new; Undo populate removes only untouched rows; Mark all paid matches the old dialog's numbers for the same day.
- [ ] **Step 4: Commit**
  ```bash
  git add components/dashboard/checklist-v2
  git commit -m "feat: checklist v2 list menu, populate due and bulk paid"
  ```

### Task 16: Release tab and create-account sheet

**Files:**
- Create: `components/dashboard/checklist-v2/release-list.tsx`, `create-account-sheet.tsx`
- Modify: `checklist-screen.tsx`

**Interfaces:**
- Consumes: `buildReleaseView` (Task 2); the existing `AccountForm` (`components/forms/account-form.tsx`); `useChecklistItems.setChecked`; `useInvalidateBorrowerDetails`; `isConnectionGood`.
- Produces: `ReleaseList`, and `CreateAccountSheet({ release: ReleaseRowView | null; date: string; onClose(): void })`.

- [ ] **Step 1: Implement** the list: a row per release item with its typed note under it, "Create account" for an unconverted one, "Created" for a ticked one, a release item that does not parse shows as a plain row with no button, and a "New release" button opens the sheet with a borrower picker. The total on this tab is the sum of parsed principals ("released today" or "released this day").
- [ ] **Step 2: Implement `CreateAccountSheet`** as a bottom sheet containing the real `AccountForm` with `borrowerId`, `initialValues={parsed.initialValues}`, `redirectOnCreate={false}`, `borrowerName`, and the same `onSuccess` as the old widget (close, tick the item, `invalidateBorrowerDetails`, `router.refresh()` when `isConnectionGood()`). Keep the old "Check off without account" button. Make the form's Create button sticky inside the sheet and add the one-line schedule preview from `buildSchedulesPayload` only if it does not change `AccountForm`'s own behaviour; if `AccountForm` cannot host a preview without edits, skip the preview and note it in the PR.
- [ ] **Step 3: Verify** against the prototype's Release flow: prefill from the note (principal, term, first payment), "New release" with a borrower, create an account and see "Created", and the new account appears on the borrower page.
- [ ] **Step 4: Commit**
  ```bash
  git add components/dashboard/checklist-v2
  git commit -m "feat: checklist v2 release tab and create-account sheet"
  ```

### Task 17: Offline and live-update markers

**Files:**
- Modify: `components/dashboard/checklist-v2/checklist-screen.tsx`, `collect-row.tsx`, `header.tsx`

**Interfaces:**
- Consumes: `ChecklistItemsApi.waitingIds` and `flashIds` (Task 9); `useConnectionQuality` (`lib/offline/connection.ts`); `getPendingOutboxCount`.

- [ ] **Step 1: Implement** the banner under the sticky bar: "Offline · showing saved data" when offline and nothing waits, "Offline · N changes waiting" otherwise (N from `getPendingOutboxCount()`, refreshed on `OUTBOX_QUEUED` and `OUTBOX_RESULT` messages), hidden online. Rows in `waitingIds` show the cloud-upload icon and rows in `flashIds` flash. The global `OfflineIndicator` pill stays.
- [ ] **Step 2: Verify** with the network off: pay a row (banner reads "Offline · 1 change waiting", the row shows the icon), reload and see it persist, reconnect and see "Synced 1 offline change." with the icon gone; from a second tab pay another row and see it update and flash here.
- [ ] **Step 3: Commit**
  ```bash
  git add components/dashboard/checklist-v2
  git commit -m "feat: checklist v2 offline banner and live-update flash"
  ```

### Task 18: Trial, then swap the routes

Run only after the owner has used `/daily-checklist/v2` for about a week and says to switch.

**Files:**
- Move: `app/(dashboard)/daily-checklist/page.tsx` to `app/(dashboard)/daily-checklist/classic/page.tsx`
- Move: `app/(dashboard)/daily-checklist/v2/page.tsx` to `app/(dashboard)/daily-checklist/page.tsx`
- Modify: `components/offline-sync-manager.tsx` (`STATIC_ROUTES`: replace `/daily-checklist/v2` with `/daily-checklist/classic`)

- [ ] **Step 1: Make the moves and the one-line edit above.** `components/bottom-nav.tsx` and every other link to `/daily-checklist` stay unchanged.
- [ ] **Step 2: Verify** `npm run build` succeeds, `/daily-checklist` shows the new screen and `/daily-checklist/classic` the old one, both work offline after the next sync.
- [ ] **Step 3: Commit**
  ```bash
  git add app components/offline-sync-manager.tsx
  git commit -m "feat: make the redesigned checklist the default and keep the old one at /classic"
  ```

### Task 19: Cleanup

Run only after one more cycle on the new default, with the owner's go-ahead.

**Files:**
- Delete: `app/(dashboard)/daily-checklist/classic/`, `components/dashboard/daily-notes-widget.tsx`, `components/mockups/`, `app/(dashboard)/checklist-mockup/`
- Modify: `components/offline-sync-manager.tsx` (drop `/daily-checklist/classic`)
- Delete or trim, after confirming no other importer remains (`grep -rn` for each): `ChecklistInput` and the old-only parts of `components/dashboard/checklist/` that nothing else uses.

- [ ] **Step 1: Delete and trim** as listed; keep `payment-dialogs.tsx` exports the new sheets use (`AccountSummaryHeader`) and `manual-payment-dialog.tsx` only if still imported.
- [ ] **Step 2: Verify** `npx tsc --noEmit -p .`, `npm test`, `npm run build`; for each deleted symbol `grep -rn "<name>" app components lib` finds nothing.
- [ ] **Step 3: Commit**
  ```bash
  git add -A
  git commit -m "chore: remove the old checklist widget and the prototype"
  ```
