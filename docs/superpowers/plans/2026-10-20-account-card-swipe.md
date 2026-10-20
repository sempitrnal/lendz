# Swipeable Account Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the compact/expanded account card with one fixed card that has two swipeable panes.

**Architecture:** A fixed band (kind colour, date, name, menu) sits above a horizontal scroll-snap track of two panes. Pure helpers in `lib/account-card/` turn scroll progress into animation values and card text, so they are unit tested. A client component `SwipePanes` owns the track, pager and scroll listener, and writes CSS variables; `AccountCard` supplies the content.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Vitest (`lib/**/*.test.ts` only, so UI is verified by hand). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-account-card-swipe-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before touching anything Next-specific (`AGENTS.md`). This plan only changes client components and pure helpers.
- Pane 1 principal: 28px, weight 800. Band colours come from `TONES` in `lib/account-tones.ts` (loan violet, cash advance amber, manual flat lime, manual rolling cyan).
- Swipe values: pane 1 content slides left up to 48px, scales to 0.9, opacity `1 - min(1, 1.6p)`; pane 2 content slides in from 40px, progress `min(1, 1.2p)`; tiles rise from 36px low, scale from 0.7, untilt from -6deg, progress `clamp01(1.6p - 0.18i)`; dots scale from 0, progress `clamp01(2p - 0.6 - 0.12i)`; pager dot widens from 5px to 27px (`5 + 22p`).
- Tile colours by position: left to pay yellow-50, collected emerald-50, ginansya teal-50, total due slate-50; dark mode uses low-opacity variants like `TILE_TONES`.
- Long-press selects after 500ms and cancels when the pointer moves 8px.
- Reduced motion: no tile or dot effects, no slide, height jumps at p = 0.5, panes still snap.
- Hit targets stay 40px (kebab, checkbox). Dots stay rounded squares (`rounded-md`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Account with `totalDue` 0 or `principal_amount` null/0: bar is 0%, no NaN or "₱NaN", no crash.
- Very large amounts (₱1,000,000,000 principal at 28px on a 320px screen): truncates, never wraps the band or overflows the card.
- Scheduled account with no installments (older cached data, `installments` undefined): pane 2 is tiles only, pane 1 right-hand label is empty, no crash.
- Content changes while on pane 2 (payment recorded, font scale changed, orientation change): height re-measures and the pane stays aligned.
- First paint before hydration shows pane 1's height, not the taller pane 2's, so the list doesn't jump when React loads.

---

### Task 1: Swipe progress helpers

**Files:**
- Create: `lib/account-card/swipe-progress.ts`
- Test: `lib/account-card/swipe-progress.test.ts`

**Interfaces:**
- Produces (all pure, exported):
  - `clamp01(n: number): number`
  - `paneProgress(scrollLeft: number, paneWidth: number): number` (0 to 1, 0 when `paneWidth <= 0`)
  - `blendHeight(h0: number, h1: number, p: number, reduceMotion: boolean): number`
  - `paneOneVars(p: number, reduceMotion: boolean): { o: number }` where `o = 1 - min(1, 1.6p)`, or 1 when reduced
  - `paneTwoVars(p: number, reduceMotion: boolean): { i: number }` where `i = min(1, 1.2p)`, or 1 when reduced
  - `tileProgress(p: number, index: number, reduceMotion: boolean): number`
  - `dotProgress(p: number, index: number, reduceMotion: boolean): number`
  - `pagerWidths(p: number): [number, number]`

- [ ] **Step 1: Write the failing tests** in `swipe-progress.test.ts`: `paneProgress(160, 320)` is 0.5 and clamps to 0 and 1 outside `[0, 320]`, with width 0 giving 0; `blendHeight(100, 200, 0.5, false)` is 150 and `blendHeight(100, 200, 0.49, true)` is 100, `(…, 0.5, true)` is 200; `paneOneVars(1, false).o` is 0 and `paneOneVars(0.3, false).o` is `1 - 0.48`; `paneTwoVars(1, false).i` is 1 and `paneTwoVars(0.5, false).i` is 0.6; `tileProgress(1, 0, false)` is 1, `tileProgress(0.5, 3, false)` is `0.8 - 0.54` and `tileProgress(0, 0, false)` is 0; `dotProgress(0.3, 0, false)` is 0, `dotProgress(0.6, 0, false)` is 0.6, `dotProgress(1, 5, false)` is `2 - 0.6 - 0.6` clamped to 1, and `dotProgress(0.35, 4, false)` is `0.7 - 0.6 - 0.48` clamped to 0; all three progress functions return 1 when `reduceMotion` is true; `pagerWidths(0)` is `[27, 5]` and `pagerWidths(1)` is `[5, 27]`. Use `toBeCloseTo` for the fractional ones.
- [ ] **Step 2: Run** `npx vitest run lib/account-card/swipe-progress.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the functions above in `swipe-progress.ts`, with the formulas copied from Global Constraints.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/account-card
git commit -m "feat: swipe progress helpers for the account card"
```

---

### Task 2: Card summary helpers

**Files:**
- Create: `lib/account-card/summary.ts`
- Test: `lib/account-card/summary.test.ts`

**Interfaces:**
- Consumes: `InstallmentDot` from `@/lib/payment-schedule/installment-dots`.
- Produces:
  - `formatAmount(n: number): string` (the card's current `fmt`: `toLocaleString` with `maximumFractionDigits: 2`)
  - `payoffPercent(totalPaid: number, totalDue: number): number` (0 to 100, 0 when `totalDue <= 0` or inputs aren't finite)
  - `barRightLabel(opts: { isManual: boolean; installments: InstallmentDot[]; totalPaid: number }): string`: manual gives `"₱<formatAmount(totalPaid)> collected"`; scheduled gives `"<paid> of <n> paid"`; scheduled with no installments gives `""`.

- [ ] **Step 1: Write the failing tests**: `payoffPercent(8000, 21000)` is about 38.1, `payoffPercent(5, 0)` is 0, `payoffPercent(Number.NaN, 10)` is 0, `payoffPercent(30, 10)` is 100; `barRightLabel` returns `"3 of 6 paid"` for six dots with three `state: "paid"`, `""` for an empty list when not manual, and `"₱1,500 collected"` for manual with `totalPaid` 1500; `formatAmount(379.997)` parses back (strip separators) to 380, so the test does not depend on the runner's locale.
- [ ] **Step 2: Run** `npx vitest run lib/account-card/summary.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions in `summary.ts`.
- [ ] **Step 4: Run** the test file. Expected: PASS. Then run `npx vitest run` and expect all suites green.
- [ ] **Step 5: Commit**

```bash
git add lib/account-card
git commit -m "feat: card summary helpers (payoff percent, bar label)"
```

---

### Task 3: SwipePanes component

**Files:**
- Create: `components/borrower/swipe-panes.tsx`

**Interfaces:**
- Consumes: everything exported by `lib/account-card/swipe-progress.ts`.
- Produces: `export function SwipePanes(props: { panes: ReactNode[]; labels: string[]; className?: string }): JSX.Element` (`"use client"`).
  - Markup: a root `div` (CSS variables are set on it) containing a `div.track` (`role="group"`, `aria-roledescription="carousel"`, `tabIndex={0}`, `overflow-x: auto`, `scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`, hidden scrollbar, `align-items: flex-start`) and a pager (`aria-hidden`) of one `<i>` per pane. Each pane is `div.pane` (`flex: 0 0 100%`, `scroll-snap-align: start`, `scroll-snap-stop: always`, `role="group"`, `aria-label={labels[i]}`).
  - Pane 1's content is wrapped in an element styled `opacity: var(--o, 1)` and `transform: translateX(calc((1 - var(--o, 1)) * -48px)) scale(calc(0.9 + 0.1 * var(--o, 1)))`; pane 2's content in one styled `transform: translateX(calc((1 - var(--i, 1)) * 40px))`.
  - Children may opt in to per-item motion with `data-swipe="tile"` (styled by the card with `opacity: var(--t, 1)` and `transform: translateY(calc((1 - var(--t, 1)) * 36px)) scale(calc(0.7 + 0.3 * var(--t, 1))) rotate(calc((1 - var(--t, 1)) * -6deg))`) or `data-swipe="dot"` (`opacity` and `transform: scale(var(--t, 1))`). The component sets `--t` on each such element, in DOM order.
  - With one pane: no pager, `overflow: hidden`, no scroll listener, no height logic.

- [ ] **Step 1: Implement** a `useLayoutEffect` that measures `panes[i].scrollHeight` and sets the track height to `blendHeight(h0, h1, p, reduced)`. Panes after the first render with inline `height: 0` until the first measurement, then clear it, so server HTML shows pane 1's height only (Review Focus: no jump on hydration).
- [ ] **Step 2: Implement** one passive `scroll` listener on the track that batches into `requestAnimationFrame`: compute `p = paneProgress(track.scrollLeft, track.clientWidth)`, set `--o` and `--i` on the root, `--t` on each `[data-swipe="tile"]` via `tileProgress` and on each `[data-swipe="dot"]` via `dotProgress`, the track height, and the pager pill widths and colours from `pagerWidths`. Read `matchMedia("(prefers-reduced-motion: reduce)")` once per mount and listen for changes.
- [ ] **Step 3: Implement** a `ResizeObserver` on both panes that re-measures and re-applies the current progress, plus a `resize` listener that re-snaps with `track.scrollTo({ left: round(p) * clientWidth })` so orientation changes keep the pane aligned. Disconnect and remove everything on cleanup.
- [ ] **Step 4: Implement** keyboard: `ArrowRight` / `ArrowLeft` on the track call `track.scrollBy({ left: ±clientWidth, behavior: reduced ? "auto" : "smooth" })` and `preventDefault`.
- [ ] **Step 5: Verify** `npx tsc --noEmit` is clean and `npx eslint components/borrower/swipe-panes.tsx` shows no errors in this file.
- [ ] **Step 6: Commit**

```bash
git add components/borrower/swipe-panes.tsx
git commit -m "feat: SwipePanes scroll-snap track with progress-driven motion"
```

---

### Task 4: Rebuild AccountCard on SwipePanes

**Files:**
- Modify: `components/borrower/account-card.tsx` (rewrite the render; keep `ScheduleDots`, `dotClasses`, `dotWindow`, `shortDate`, `ymd`, long-press and selection logic)
- Modify: `lib/account-tones.ts` (add the stat-tile tones)

**Interfaces:**
- Consumes: `SwipePanes` (Task 3), `formatAmount`, `payoffPercent`, `barRightLabel` (Task 2), `TONES` and `accountTone`.
- Produces:
  - `export const SWIPE_TILE_TONES` in `account-tones.ts`: an array of four `{ box, label, value }` class sets in the order left to pay, collected, ginansya, total due, with light and dark variants.
  - `AccountCard` props lose `expanded`, `onToggleExpand` and `animateToggle`; all other props are unchanged.

- [ ] **Step 1: Add `SWIPE_TILE_TONES`** to `lib/account-tones.ts` (50-level fills with a 100-level border for light; the existing low-opacity pattern for dark).
- [ ] **Step 2: Rewrite the render** to the layout in the spec: the band (`TONES[tone].band`) containing the selection checkbox or `CalendarTile` (size `sm`, next-due date), name, a kind-and-rate line (`metaText`), the status dot and `AccountCardMenu`; below it `<SwipePanes>` with labels `["Summary", "Details"]`.
  - Pane 1: principal from `account.principal_amount` (28px, weight 800, `truncate`), a payoff bar (`payoffPercent(totalPaid, totalDue)`), a row with `₱{formatAmount(amountLeftToPay)} left` and `barRightLabel(...)`, then the next line `Next {shortDate} · ₱{amount}` (amount and "overdue" in rose when `hasOverdue`; hidden for manual flat and when there is no next collection).
  - Pane 2: four tiles from `SWIPE_TILE_TONES` (labels "left", "collected" ("paid" for manual), "ginansya", "total due"; values `amountLeftToPay`, `totalPaid`, `profitPerSchedule`, `totalDue`), each with `data-swipe="tile"`; then `ScheduleDots` with `data-swipe="dot"` on each dot, only when `useDots`.
  - Pending accounts: one pane (principal, kind, "Pending activation" and the Activate button where the next line goes, no bar).
  - Each pane gets a stretched `<button className="absolute inset-0 z-[1]">` calling `handleMainClick` (now: selection toggle in selection mode, otherwise `onOpen`), with controls above it at `z-10`.
- [ ] **Step 3: Remove** the compact row, the expanded layout, `AnimatePresence`, `collapseMotion`, `EXPAND_EASE`, the overdue list, the partials block, `overdueExpanded`, `partialsExpanded`, `releasedAgo`/`releasedYear` if unused, and any imports that become unused. Delete the rose left edge.
- [ ] **Step 4: Cancel long-press on movement:** record the pointer-down position and clear the timer in `onPointerMove` once the pointer is 8px away.
- [ ] **Step 5: Verify** `npx tsc --noEmit` (it will fail in `borrower-accounts-section.tsx` for the removed props; that is fixed in Task 5, so confirm only those errors remain) and `npx eslint components/borrower/account-card.tsx lib/account-tones.ts` reports nothing new.
- [ ] **Step 6: Commit**

```bash
git add components/borrower/account-card.tsx lib/account-tones.ts
git commit -m "feat: fixed account card with swipeable details"
```

---

### Task 5: Remove expand/collapse from the section

**Files:**
- Modify: `components/borrower/borrower-accounts-section.tsx` (around lines 396-482, 636-672, 868-890, 1060-1070)

**Interfaces:**
- Consumes: `AccountCard` without the three removed props (Task 4).

- [ ] **Step 1: Delete** `expandedIds`, `isAccountExpanded`, `animateToggles`, `expandedStorageKey`, `saveExpanded`, `toggleAccountExpanded`, `allExpanded`, the "expand all / collapse all" button, `toggleExpand` in `latestHandlers`, `stableToggleExpand`, and the `expanded`, `animateToggle`, `onToggleExpand` props on `<AccountCard>`.
- [ ] **Step 2: Keep scroll restoration working.** It currently waits for `stateRestored` (set after the expanded-card restore). Remove `stateRestored` and run that `useLayoutEffect` once on mount, with the same body: cards are now the same height at first render, so restoring the scroll position needs no wait.
- [ ] **Step 3: Verify** `npx tsc --noEmit` clean, `npx vitest run` green, `npm run build` passes, and `npx eslint components/borrower` shows no errors beyond the ones already present before this plan (compare with `git stash` baseline if unsure).
- [ ] **Step 4: Manual check on a phone-width viewport** (Chrome devtools or a real phone, `npm run dev`):
  - swipe tracks the finger; the card height grows and shrinks with it; no empty space under pane 1
  - tap opens the account; a swipe does not; vertical page scroll over a card works
  - long-press selects; a swipe does not select
  - one card each of loan, cash advance, manual flat, manual rolling, pending, and an offline-created (pending sync) account
  - a zero-total account and a ₱1,000,000,000 principal (edit one in the form, then revert)
  - pay an installment while on pane 2: height and tiles update, pane stays aligned
  - open an account, go back: scroll position is restored
  - dark mode, reduced motion on, largest font scale, arrow keys on a focused card, no layout jump when reloading with throttled CPU
- [ ] **Step 5: Commit**

```bash
git add components/borrower/borrower-accounts-section.tsx
git commit -m "refactor: drop expand/collapse state from the accounts section"
```
