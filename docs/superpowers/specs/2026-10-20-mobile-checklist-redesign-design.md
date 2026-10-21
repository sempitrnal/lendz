# Daily checklist: mobile redesign

Status: draft for review. Working prototype: `/checklist-mockup` (`components/mockups/checklist-mockup.tsx`, fake data, not linked, not committed). The prototype is the reference for layout and behaviour; it is thrown away once the real screen ships.

## Why

On a phone the checklist is a long scroll. It has two category cards, each with its own add box and a header that takes space before any row. Rows are two or three lines tall, ticking a row always opens a payment dialog, and carried-over rows are mixed in with today's. The owner uses it for two jobs, collecting payments and turning released loans into accounts, and both take more taps than they should.

## What we're building

One mobile-first screen at `/daily-checklist` that replaces `DailyNotesWidget`. Same data, same label format, same server actions. A new layout and new interactions.

Only two categories are in use, "received" and "released", so the screen has two tabs instead of two category cards:

- **Collect** shows every item whose category is not "released" (so a category added later is not hidden).
- **Release** shows items in the "released" category.

### Layout, top to bottom

1. **Date row.** Previous day, the date (tap opens the date picker) with a "today / yesterday / tomorrow" chip, next day. "Back to today" appears under it on any other day. On the right, a "⋯" list menu (Collect only) and a "+" add button.
2. **Total.** Collect: ₱ left, "n/total paid", and a progress bar. Release: ₱ released that day.
3. **Sticky bar.** The Collect / Release switch with counts, and on Collect the filter chips All, Overdue, Today, Paid with counts. It sticks under the app's top bar.
4. **List.** See below.

### Collect list

- Rows are grouped by borrower category (the existing `groupByBorrowerCategory`), each group collapsible with its ₱ left and done count. Group headers keep the category tint.
- **Carried over** is one amber collapsible section after today's groups. It holds rows whose every installment is due before the selected day, up to 7 days back (the existing `CARRY_OVER_DAYS`), and is grouped by borrower category inside.
- Fully paid rows sink to the bottom of their group.
- Filters: **Overdue** is unpaid rows with a late installment. **Today** is unpaid rows with an installment whose due date is the selected day (the prototype counts anything not yet late, which also catches future dues added through `/next`; the real screen should compare dates). **Paid** is settled rows.

### A collection row

Single line: borrower name, then a second muted line, ₱ amount still owed, and one pay control on the right.

| Row | Second line | Pay control |
|---|---|---|
| One open installment | "oct 15 · 4d late · loan" (late in rose; "₱400 paid ·" prefix when partly paid) | check circle; one tap pays what is left in full |
| Several open installments | "2 due · oldest 4d late" | pill "Pay 2" |
| Fully paid | "paid · tap to edit", struck name, dimmed | filled check |

Tap behaviour:

- Single open installment: tapping the check pays it in full and shows a toast with Undo (6 s). Tapping the row opens the pay sheet.
- Several open installments: "Pay 2" opens the **pay sheet** (decided: sheet first, not instant). Tapping the row expands it inline, with a check per installment and "Pay all ₱x".
- Paid row: the row or its check opens the **edit payments** sheet. There is no one-tap undo on the check.
- Swipe left reveals three buttons: **Partial** (unpaid rows; **Payment** on paid rows), **Note**, **More**. A swipe must never also count as a tap (compare pointer-down and pointer-up distance, 8 px). Vertical scrolling must still work (`touch-action: pan-y`, drag direction lock).

### Pay sheet

Bottom sheet, one block per account: the account summary header the payment dialogs show today (type chip, "n of m paid", progress bar, ₱ paid and ₱ left), then that account's open installments as checkable rows, all ticked. Untick one to leave it unpaid. "Pay a different amount" turns each amount into an input, so a partial is just a smaller amount. The primary button reads "Record ₱x paid". The borrower's name in the title opens their page. For a part-paid row an "Edit recorded payments" link goes to the edit sheet.

This is `ScheduleCheckDialog` in check mode, restyled as a sheet. It calls the same actions and cache helpers.

### Edit payments sheet

Opened from a paid row or from the link above. One card per installment that has money recorded: an amount input plus "Paid in full" and "Not paid" shortcuts. The button reads "Save · ₱x paid", or "Remove payment" when everything goes to zero. Toast with Undo. This is `ScheduleCheckDialog` in edit mode (saving does not change the tick).

### Row menu (swipe → More)

- **Edit item**: reopens the add composer on this row (below). It changes linked dues and the note, not the borrower.
- **Open borrower page.**
- **Remove from list**: deletes the checklist item only, never the payments (same as Delete today). Toast with Undo.

### Add sheet (the "+")

One sheet replaces the add box in every category. It is a composer that keeps both features of the current input and reshapes them for a phone:

- **`@`** typed in the box shows inline borrower suggestions. An "@ Borrower" button opens a searchable list. The pick becomes a coloured pill. Several pills are allowed; dues and `/next` use the last one.
- **`/next`** typed (once someone is mentioned), or the "₱ Next dues" button, opens a pick-the-dues step inside the sheet: "Select all", then each upcoming installment with a checkbox. Picks come back as chips ("oct 22 · Loan · ₱2,100") and become one collection row, linked by schedule id in the same label format as today. With no borrower yet the sheet says "Mention a borrower first (@name)".
- **Manual-schedule accounts** appear in that step as a card with the account summary and "Add payment" (amount, date, quick amounts including the full balance). A rolling account says that what is left of the open schedule rolls into a new one with interest. The payment becomes a green "paid" chip and the item is created already paid. This is `ManualPaymentDialog`, as a sheet step.
- Free text with no dues is a plain note item.
- In **Release** mode the sheet is `@borrower` plus the typed note ("10,000 - 10 months for 110426"), read live by `parseReleasedLabel`: "Reads as ₱10,000 loan · 10 months · first payment Nov 4, 2026". The button reads "Add release".
- In **edit** mode the title is "Edit item", `@` is hidden, and the button reads "Save changes".

### List menu ("⋯", Collect)

- **Populate due.** Adds one row per borrower who has something due on the selected day or in the 7 days before, skipping borrowers who already have a collection row that day. Uses `/api/checklist/due` and `buildDueLabel`, as today. Toast "Added N borrowers" with Undo (8 s), or "Nothing new to add — everyone due or carried over is already listed". The same action is a big button on the empty list.
- **Mark all paid (n).** Opens the bulk sheet: a summary (borrowers, collections to mark paid, already paid, total), a payment date, Cancel and "Mark all paid". Toast "Marked N collections paid" with Undo. This is `BulkPaidDialog`.
- **Undo populate** (only right after a populate).
- **Clear all (n).** Toast with Undo.
- A link to Manage categories (`/daily-checklist/categories`) lives here instead of the header gear.

### Release tab

A list of released items, each with its typed note under it. An unconverted item has a "Create account" button; a converted one shows "Created". "New release" opens the create sheet with a borrower picker.

**Create account sheet.** A bottom sheet whose fields mirror `components/forms/account-form.tsx` in the same order: Account type, Schedule mode, Account status, Interest type (manual only), Principal amount (₱ prefix, chips 5,000 to 50,000), Interest rate (chips 3.3, 3.8, 4, 5), Release date (with "today"), First payment date (chips for the next 4th, 5th, 7th, 8th, 10th, 15th), Calculate skipped schedules, Payment frequency (with the "(4th & 19th)" hint), and Term (chips 1 to 12). It is prefilled from the typed note exactly as `parseReleasedLabel` does today. The Create button is sticky at the bottom. Validation messages are the form's own.

**Implementation note:** the real screen must render the existing `AccountForm` inside the sheet (with `initialValues` and `redirectOnCreate={false}`), not a copy. The prototype copies the fields only because it must not write to the database. One addition over the real form is allowed: a one-line schedule preview ("20 × ₱690, Nov 4, 2026 to Aug 19, 2027") from `buildSchedulesPayload`.

### Date navigation

Each day has its own list, as today (`checklist_date`). Previous and next day, a native date picker, and "Back to today". Changing day dismisses open toasts. An Undo on a toast only touches the day it came from. Populate due, release parsing and lateness are all worked out for the selected day, not the real today.

### Offline and live updates

Behaviour is the same as today; the new screen only makes it visible:

- Writes still go through the existing offline outbox (`wasQueuedOffline`, `getPendingOutboxCount`). Cached items and schedules still render with no connection.
- While offline a banner reads "Offline · showing saved data", or "Offline · N changes waiting". Each row changed offline shows a small cloud-upload icon until it syncs. On reconnect the existing "Synced N offline changes." toast appears and the markers clear.
- The Supabase realtime channel and `isEchoOfLocalState` stay. A row that changes from another device updates in place and flashes for about 2.5 s.
- The global offline pill from `OfflineIndicator` is unchanged.

## What is not changing

- Tables: `daily_checklist_items` (label, `is_checked`, `checklist_date`, `sort_order`, `category_id`) and `daily_checklist_categories`. No migration.
- The label format: `[name](/borrowers/<id>)` mentions and `#badge:date:<iso>|<scheduleId>` / `#badge:type:<loan|cash_advance>` badges. Old and new UIs can read each other's items, which is what makes a gradual rollout safe.
- Payment truth comes from the linked schedules, as today (`summarizeChecklist`). A row is "paid" when every linked installment is paid. The tick (`is_checked`) is set when a row becomes fully paid and cleared when its payments are removed.
- The server actions and caches the payment dialogs already use (`markSchedulesPaidAction`, `applyPartialPaymentAction`, `addManualScheduleAction`, `applyPaymentsToCache`, `warmScheduleCache`).
- The quick-add button in the bottom nav.

## Intentional differences from today

| Today | New |
|---|---|
| "Received" and "released" cards | Collect and Release tabs |
| An add box in every category | One "+" sheet |
| Ticking a collection row always opens the payment dialog | One open installment: one tap pays it, with Undo. Several: the pay sheet |
| Ticked row asks "uncheck or reopen the payment" | Tap opens edit payments |
| Row "⋯" menu: Edit, Delete | Swipe: Partial / Note / More, and More holds Edit item, Open borrower page, Remove |
| Inline editing of the whole label | Edit item reopens the composer |
| "Add carry-over" and "Undo add carry-over" (marked TEMP in code) | Dropped |

## Cases and edge behaviour

- **Row with a partial payment:** shows what is left; the check circle is outlined in the primary colour; Edit recorded payments is available in the pay sheet.
- **Paying more than owed:** amounts clamp to what is left.
- **Several installments on different accounts:** one summary header per account in the pay sheet.
- **Item with no schedule links (plain note):** shown in Collect as a simple row with the same tick and menu; no pay controls.
- **Release item that fails to parse:** the "Add release" button stays disabled; nothing is created.
- **Removing a row while offline:** queued like any write, with the sync marker.
- **Sheet reopening:** every open must start from a clean state, even if the previous sheet is still animating closed. The prototype remounts sheet content on each open.
- **Gesture-free access:** every swipe action also needs a non-gesture path for desktop and screen readers. The pay sheet gets a "More" link to the row menu. (Needs the owner's OK.)

## Architecture

Replace `DailyNotesWidget` (about 2,000 lines) with focused units, each testable on its own:

| Unit | Responsibility |
|---|---|
| `ChecklistScreen` | Date state, loading, realtime and offline wiring, which sheet is open |
| `ChecklistHeader` | Date row, total, Collect/Release switch, filter chips |
| `CollectList`, `CollectRow` | Groups, carried-over section, swipe and pay controls |
| `PaySheet`, `EditPaymentsSheet`, `NoteSheet`, `RowMenuSheet`, `BulkPaidSheet`, `ListMenuSheet` | One sheet each, sharing a `Sheet` wrapper |
| `AddSheet` | The composer: mentions, `/next`, manual payment, edit mode, release parsing |
| `ReleaseList`, `CreateAccountSheet` | Release tab; wraps the existing `AccountForm` |
| `lib/checklist/*` (new pure helpers) | Row state, lateness, filters, grouping, populate selection, so they can be unit tested |

Reuse, do not rewrite: the label helpers in `lib/checklist/labels.ts`, `released.ts`, `totals.ts`, `dates.ts`, the offline caches, and the payment dialogs' action code. Where a dialog's submit logic is needed by a sheet, extract it into a hook (for example `useRecordPayments`) used by both, rather than copying it.

The swipe uses `framer-motion` drag, already a dependency. Bottom sheets follow the pattern in `components/bottom-nav.tsx` and `components/quick-actions.tsx`.

## Testing

- **Unit (vitest):** row state and lateness for any selected day, filter rules, carried-over and grouping, the populate selection rule (skip listed borrowers and linked schedules), the pay and edit amount clamps. Existing tests in `lib/checklist/` keep passing.
- **Manual, phone width, light and dark:** each flow in this spec, including the swipe-versus-tap behaviour on a real touch device (the prototype was only exercised with synthetic input).
- **Manual, offline:** make changes offline, reload, reconnect, and check the markers and the sync toast.
- **Regression:** items created by the old UI render and behave correctly in the new one, and the reverse.

## Rollout

1. Build the new screen at `/daily-checklist/v2` while the old one stays at `/daily-checklist`.
2. Use it for a week or two, then swap the routes and keep the old one at `/daily-checklist/classic` for one more cycle.
3. Delete the old widget, the classic route, the prototype and its route (`components/mockups/`, `app/(dashboard)/checklist-mockup/`).

## Open questions

1. **Pay 2 opens the sheet first** (the spec's choice). Confirm, or switch to instant with Undo.
2. **Gesture-free access** via a "More" link in the pay sheet. Confirm.
3. **Desktop.** The design is mobile-first. On wide screens the screen renders as a centred phone-width column. Confirm, or ask for a wider layout.
4. **Other categories.** The owner uses only received and released. If a third category is ever added it appears in Collect; confirm that is acceptable.

## Out of scope

- The renew-loan flow (parked).
- Changes to the categories management page.
- Any database or server-action change.
