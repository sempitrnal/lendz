# What's new tours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a deploy, everyone sees a one-time spotlight tour on the real screen that points at what changed, with a "What's new" page to replay any tour.

**Architecture:** Tours are plain data in `lib/tours/tours.ts`, matched to the page by pathname. Pure logic (`lib/tours/logic.ts`) picks the next unseen tour and drops steps whose target is missing. A client `TourProvider` mounted in the dashboard layout runs a `TourSpotlight` overlay and remembers seen tours in `localStorage`. Replay is a query param (`?tour=<id>`), so the What's new page is a server page of links.

**Tech Stack:** Next 16 (App Router; this repo's version differs from older Next, so read `node_modules/next/dist/docs/` before Next-specific code), React 19, Tailwind 4, Vitest (`lib/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-22-whats-new-tours-design.md`

## Global Constraints

- Seen state lives in `localStorage` under the key `lendz-tours-seen` (a JSON array of tour ids). No database change.
- Tour ids are unique and stable (`YYYY-MM-DD-topic`); a released tour is never edited, a follow-up gets a new tour.
- Targets are `[data-tour="…"]` selectors only.
- The provider waits up to 3000 ms, polling every 200 ms, for the first playable target before starting; if none appears the tour is skipped and not marked seen.
- A tour never starts while another is running or while a sheet or dialog is open (`[role="dialog"]` present in the DOM).
- Skip, Done and Escape mark the tour seen; closing the tab midway does not. Replay (`?tour=<id>`) does not change the seen list.
- The overlay sits above the checklist drawers (drawers use z-index 9999; use 10000+) and honours `prefers-reduced-motion`.
- Videos, an admin screen, and multi-page tours are out of scope.

## Review Focus

- `localStorage` unavailable or holding invalid JSON: tours still play, nothing throws, the seen list reads as empty.
- A tour whose targets are all missing (an empty list): skipped quietly, not marked seen, no dim overlay left behind.
- Navigating away mid-tour: the overlay closes and is not marked seen.
- An unknown or malformed `?tour=` id: ignored, normal behaviour.
- A tour step whose target scrolls off screen or is inside a scroll container: scrolled into view before the popup is placed.

---

### Task 1: Tour logic and types

**Files:**
- Create: `lib/tours/logic.ts`
- Test: `lib/tours/logic.test.ts`

**Interfaces:**
- Produces:
  - `type TourStep = { target: string; title: string; body: string; placement?: "top" | "bottom" }`
  - `type Tour = { id: string; title: string; date: string; page: string; steps: TourStep[] }`
  - `const SEEN_KEY = "lendz-tours-seen"`
  - `nextTour(tours: Tour[], pathname: string, seen: string[]): Tour | null`
  - `tourById(tours: Tour[], id: string | null): Tour | null`
  - `playableSteps(steps: TourStep[], exists: (selector: string) => boolean): TourStep[]`
  - `readSeen(storage?: Pick<Storage, "getItem">): string[]`
  - `markSeen(id: string, storage?: Pick<Storage, "getItem" | "setItem">): void`

- [ ] **Step 1: Write the failing tests** in `lib/tours/logic.test.ts`: `nextTour` returns the oldest tour (list order) whose `page` equals the pathname and id is not in `seen`, and null when all are seen or none match the page; `tourById` returns the tour for a known id and null for null, empty or unknown ids; `playableSteps` keeps only steps for which `exists(step.target)` is true and keeps order; `readSeen` returns `[]` for a missing key, for invalid JSON, for non-array JSON, and when `getItem` throws; `markSeen` appends the id once (calling it twice stores one copy), keeps earlier ids, and does not throw when `setItem` throws. Use plain fake storage objects.
- [ ] **Step 2: Run** `npx vitest run lib/tours/logic.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the types and functions above in `lib/tours/logic.ts`. `readSeen` and `markSeen` default `storage` to `window.localStorage` and guard every access with try/catch (an SSR call with no `window` also reads as empty).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: tour logic`.

### Task 2: Tour data and the first tour's targets

**Files:**
- Create: `lib/tours/tours.ts`
- Modify: `components/dashboard/checklist-v2/header.tsx` (tablist, add `data-tour="checklist-tabs"`), `components/dashboard/checklist-v2/collect-row.tsx` (the row `li`: add `data-tour="checklist-multi-row"` when `expandable`; the "Pay N" pill button: `data-tour="checklist-pay-pill"`)
- Test: `lib/tours/tours.test.ts`

**Interfaces:**
- Consumes: `Tour`, `TourStep` from `lib/tours/logic.ts`.
- Produces: `export const TOURS: Tour[]` (oldest first) containing one tour: id `2026-10-22-checklist`, title `Checklist update`, date `2026-10-22`, page `/daily-checklist`, with three steps: (1) target `[data-tour="checklist-tabs"]`, title "Collect and Release", body "Switch tabs here. The tab and the day are in the address, so you can reload or share a link and land in the same place."; (2) target `[data-tour="checklist-multi-row"]`, title "Several schedules", body "Tap the borrower's row to see every schedule they owe, including paid ones."; (3) target `[data-tour="checklist-pay-pill"]`, title "Pay and review", body "Opens the payment sheet. Tap an account's card in it to open that account."

- [ ] **Step 1: Write the failing test** `lib/tours/tours.test.ts`: every tour id is unique and matches `^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$`; every tour has at least one step; every step target matches `^\[data-tour="[a-z0-9-]+"\]$`; every `page` starts with `/`.
- [ ] **Step 2: Run** `npx vitest run lib/tours/tours.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `TOURS` as specified, and add the three `data-tour` attributes in the files above.
- [ ] **Step 4: Run** `npx vitest run lib/tours` and `npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat: first tour and its targets`.

### Task 3: Spotlight player

**Files:**
- Create: `components/tours/tour-spotlight.tsx`, `components/tours/tour-provider.tsx`
- Modify: `app/(dashboard)/layout.tsx` (mount `<TourProvider />` inside the fragment, after `<BottomNav />`)

**Interfaces:**
- Consumes: `TOURS`; `nextTour`, `tourById`, `playableSteps`, `readSeen`, `markSeen` from `lib/tours/logic.ts`.
- Produces:
  - `TourSpotlight({ tour, steps, onFinish, onSkip }: { tour: Tour; steps: TourStep[]; onFinish(): void; onSkip(): void })` (client): portal overlay with a rounded cut-out around the current step's target, popup with title, body, step dots, Back/Next (Done on the last step) and Skip; scrolls the target into view; repositions on resize and scroll; Escape calls `onSkip`; labelled `role="dialog"` with focus moved into it and restored on close; no transitions under `prefers-reduced-motion`.
  - `TourProvider()` (client, no props): reads `usePathname()` and the `tour` search param; on a pathname change picks `tourById(TOURS, param)` (replay, only if its page matches the pathname) else `nextTour(TOURS, pathname, readSeen())`; polls every 200 ms up to 3000 ms for the first target, does not start while another tour runs or a `[role="dialog"]` exists, then runs `TourSpotlight` with `playableSteps`. Finish or Skip marks the tour seen unless it was a replay. Unmounting or a pathname change closes the overlay without marking seen.

- [ ] **Step 1: Read** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` and wrap any `useSearchParams` use in a `Suspense` boundary as it requires.
- [ ] **Step 2: Implement** `TourSpotlight`: the cut-out is a fixed, rounded box at the target rectangle (plus 6 px padding) with a very large spread `box-shadow` as the dim layer; the popup is placed on `placement` (default `bottom`) and flips to the other side when it would leave the viewport; z-index 10000+; pointer events on the dim layer are swallowed.
- [ ] **Step 3: Implement** `TourProvider` and mount it in the layout.
- [ ] **Step 4: Verify in the browser** at phone width on `/daily-checklist` with `localStorage` cleared: the tour starts once with three steps, Next/Back/Skip/Done and Escape work and a reload after Done shows nothing; `/daily-checklist?tour=2026-10-22-checklist` replays it without changing `lendz-tours-seen`; an empty day (no multi-schedule row) plays the other steps only; opening a drawer first prevents the start; dark mode looks right. Run `npx tsc --noEmit` and `npx eslint components/tours`.
- [ ] **Step 5: Commit** `feat: tour spotlight and provider`.

### Task 4: What's new page and nav entry

**Files:**
- Create: `app/(dashboard)/whats-new/page.tsx`
- Modify: `components/bottom-nav.tsx` (add a "What's new" item to `ALL_ITEMS` linking to `/whats-new`, using a `Sparkles` icon from `lucide-react`); the desktop sidebar (`components/sidebar-nav.tsx`) gets the same entry if it keeps its own item list.

**Interfaces:**
- Consumes: `TOURS`.
- Produces: a server page listing `TOURS` newest first; each row shows title, formatted date and a "Replay" link to `` `${tour.page}?tour=${tour.id}` ``. Empty list shows "Nothing new yet."

- [ ] **Step 1: Implement** the page and the nav entries; follow the neighbouring pages' container and heading styles.
- [ ] **Step 2: Verify in the browser**: the entry appears in the More menu and sidebar, the page lists the first tour, Replay opens `/daily-checklist` and runs the tour. Run `npx tsc --noEmit`.
- [ ] **Step 3: Commit** `feat: what's new page`.

### Task 5: Final check

- [ ] **Step 1:** Run `npx vitest run lib` and `npx tsc --noEmit`; both pass.
- [ ] **Step 2:** Confirm each Review Focus line in the browser: storage blocked (set `localStorage` to throw via the browser tool) still plays and does not crash; an unknown `?tour=nope` changes nothing; navigating away mid-tour leaves no overlay and the tour plays again next visit.
