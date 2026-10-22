# What's new: interactive spotlight tours

Date: 2026-10-22. Status: design approved in chat, spec awaiting review.

## Goal

When a deploy changes how the app works, everyone who uses it gets a short,
interactive walkthrough on the real screen the first time they open the
changed page. It points at the actual button or row ("Tap the card to open
the account") so people learn the change by seeing it, not by reading notes.

## Decisions (from the owner)

- **Format:** a spotlight tour on the real screen. Not a slideshow of cards.
- **Audience:** everyone who uses the app.
- **Authoring:** Claude writes the tour for each change it ships, in the repo.
  There is no admin screen.
- **Seen state:** remembered per device in the browser. No database change.
- **Videos:** out of scope. A step may later carry an image or clip; not now.

## Non-goals

- A CMS or admin page for notes.
- Per-user (cross-device) seen state.
- Analytics on who finished a tour.
- Tours that run on a screen other than the page they name.

## Design

### Tour definitions

`lib/tours/tours.ts` exports an ordered list, oldest first:

```ts
type TourStep = {
  /** CSS selector, always a `[data-tour="…"]` attribute. */
  target: string;
  title: string;
  body: string;
  /** Preferred side of the target for the popup; flips if it doesn't fit. */
  placement?: "top" | "bottom";
};

type Tour = {
  /** Unique and stable, e.g. "2026-10-22-checklist". Never reused. */
  id: string;
  /** Shown in the What's new list. */
  title: string;
  /** ISO date of the release, shown in the list. */
  date: string;
  /** Pathname the tour runs on, e.g. "/daily-checklist". */
  page: string;
  steps: TourStep[];
};
```

Shipping a change means adding a `Tour` and adding the `data-tour` attributes
it targets. Tours are never edited after release; a follow-up change gets a
new tour.

### Pure logic (`lib/tours/logic.ts`, unit-tested)

- `nextTour(tours, pathname, seen)`: the oldest tour for this page whose id is
  not in `seen`, or null.
- `readSeen()` / `markSeen(id)`: the `lendz-tours-seen` list in
  `localStorage`. Reads and writes are wrapped in try/catch; with storage
  unavailable the list is empty and nothing is stored (the tour then shows
  again next visit, which is acceptable).
- `playableSteps(steps, find)`: drops steps whose target is not in the DOM,
  so an empty list or a hidden control never leaves a hole in the tour. If
  no steps are playable the tour is skipped without being marked seen.

### Player (`components/tours/tour-provider.tsx`, `tour-spotlight.tsx`)

- `TourProvider` is mounted once in the dashboard layout. On each pathname
  change it calls `nextTour`, then waits up to 3 seconds (polling every
  200 ms) for the first step's target to appear before starting. It never
  starts while another tour is running, or while a sheet or dialog is open.
- The spotlight is a portal with a dimmed full-screen layer and a cut-out
  around the target's rectangle (a rounded outline with a large spread
  shadow, so no mask image is needed). z-index sits above the checklist
  drawers.
- The popup shows title, body, step dots, and Back / Next / Skip. The last
  step's button reads Done. It scrolls the target into view, repositions on
  resize and scroll, and honours `prefers-reduced-motion` (no transitions).
- Finishing, or Skip, calls `markSeen(tour.id)`. Closing the tab midway does
  not mark it seen.
- Taps on the dimmed area do nothing (the tour is advanced with its buttons).
  Escape skips.
- Accessibility: the popup is a labelled dialog with focus moved into it;
  focus returns to the previously focused element on close.

### What's new list

A "What's new" item in the More menu opens a list of every tour (newest
first) with its date and a Replay button. Replay runs that tour on its page
(navigating there first if needed) without changing the seen list.

### Data flow

```
route change -> nextTour(tours, pathname, readSeen())
             -> wait for first target -> playableSteps -> run spotlight
             -> Done/Skip -> markSeen(id)
```

### Error handling

- Missing target at start: wait, then give up quietly (not marked seen).
- Target disappears mid-tour: that step is skipped.
- Storage unavailable: tours still play; they may repeat on the next visit.

## First tour

`2026-10-22-checklist`, on `/daily-checklist`, covering what changed in the
checklist: the Collect / Release tabs and their URL, tapping a row's parent to
see every schedule, the pay drawer (account card opens the account), and
created releases opening their account. Exact steps are written in the plan.

## Testing

- Unit tests for `nextTour`, `playableSteps` and the seen-list functions,
  including unavailable storage and unknown ids.
- Manual check in the browser at phone width: tour starts once, Next/Back,
  Skip, Done, Replay from What's new, a missing target skipped, dark mode.

## Out of scope / later

- Images or video in a step.
- A tour that spans more than one page.
