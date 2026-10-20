# Account card: one fixed, swipeable card

Status: draft for review. Mockups: `swipe-animated-v5.html` in the brainstorm session (not committed).

## Why

On a phone the account card has two layouts. The compact row doesn't say enough, so every card gets expanded, and the expanded card then shows too much at once. The card is also slow to scan in a list.

## What we're building

Replace the compact/expanded pair in `components/borrower/account-card.tsx` with a single card with two horizontally swipeable panes. There is no expand/collapse.

- **Band (fixed, never moves):** the existing kind colour from `lib/account-tones.ts` (loan violet, cash advance amber, manual flat lime, manual rolling cyan). It holds the calendar tile (next-due date), borrower or account name, the kind and rate line (e.g. "Loan · 5% weekly"), the status dot, and the kebab menu. Selection mode swaps the calendar tile for the 40px checkbox, as today.
- **Pane 1 (shown in the list):**
  - Principal as the lead number: 28px, weight 800.
  - Payoff bar under it, with "₱x left" on the left and "n of m paid" on the right.
  - Next line: "Next Oct 24 · ₱2,100". When the account has overdue installments the amount turns rose and "overdue" follows it.
- **Pane 2 (one swipe away):**
  - Four stat tiles in a 2x2 grid, each a fixed faint colour by position: left to pay (yellow 50), collected (emerald 50), ginansya (teal 50), total due (slate 50). Dark mode uses the existing low-opacity variants from `TILE_TONES`.
  - The installment dots (rounded squares) below the tiles, scheduled accounts only.
- **Removed:** the overdue pill, the overdue strip and list, the rose left edge, the collapse chevron, the compact row, the second layout and the persisted expanded-card list. Overdue is shown only by the rose next-due line and by the overdue dots in pane 2.
- **Pager:** two dots below the panes; the active one stretches to a pill as you drag.

Card tap opens the account page. A swipe never opens it (native scroll-snap suppresses the click after a drag).

## Cases that differ

| Account | Pane 1 | Pane 2 |
|---|---|---|
| Scheduled (default) | as above | tiles + dots |
| Manual flat | principal, bar, left; no next line | tiles only, no dots |
| Manual rolling | principal, bar, left, next collection from `nextCollections` | tiles only |
| Pending activation | principal and kind; "Pending activation" and the Activate button where the next line goes; no bar | none: a single pane, no pager, swipe disabled |
| Pending sync (offline) | as normal; status dot is sky as today | as normal |
| Selection mode | tap toggles selection, selected ring as today; swipe still works | same |

Open question for the review: manual accounts have no "n of m paid", so the right-hand label on the bar shows "₱x collected" instead.

## Animation

Panes sit in a horizontal `scroll-snap-type: x mandatory` track, with `overscroll-behavior-x: contain`. The browser's scrolling drives the motion, so it tracks the finger 1:1, vertical page scroll is untouched, and there is no new JS dependency. One rAF-batched scroll listener derives progress `p` (0 to 1) and sets CSS variables on the card:

- Pane 1 content: slides left up to 48px, scales to 0.9 and fades out (`--o`, 1 − 1.6p).
- Pane 2 content: slides in from 40px right (`--i`, 1.2p).
- Stat tiles, staggered by 0.18 per tile: rise from 36px low, scale from 0.7 and untilt from −6° (`--t`).
- Dots: scale from 0 and fade in, staggered by 0.12 per dot.
- Pager: active dot widens from 5px to 27px.
- Height: the track height is set from `p` between pane 1's and pane 2's own heights, so pane 1 has no empty space. A `ResizeObserver` re-measures when content changes (new payment, font scale).
- `prefers-reduced-motion`: no tile or dot effects, the height jumps at the halfway point, and the panes still snap.

The card rests on pane 1 whenever it is mounted. Pane position is not persisted. Cards in the list are all the same height at rest.

## Interaction details

- Long-press selects as today, but the 500ms timer is cancelled once the pointer moves 8px, so a swipe never selects.
- The kebab is a 40px target in the band, above the tap area. The tap area is the pane itself (one real button per pane); the band controls are siblings, as in the current accessibility fix.
- Each pane is its own labelled region. A screen reader reaches pane 2 without swiping: it isn't `aria-hidden` and its contents are focusable once scrolled into view; focus moving into pane 2 scrolls it into view.
- Keyboard: left/right arrows on the track move between panes.

## Files

- `components/borrower/account-card.tsx`: rewrite the body; drop the `expanded`, `onToggleExpand` and `animateToggle` props and the `AnimatePresence` compact/full blocks.
- `components/borrower/account-card-panes.tsx` (new): the track, the pager and the scroll-progress hook. Pure helpers for height and per-item progress live in `lib/account-card/swipe-progress.ts` so they can be unit tested.
- `components/borrower/borrower-accounts-section.tsx`: remove `expandedIds`, `animateToggles`, the localStorage read and write, and the expand/collapse-all control if one exists; stop passing the three props.
- `lib/account-tones.ts`: add the four stat-tile tones (light and dark) next to `TILE_TONES`.
- `components/borrower/account-card-menu.tsx`: unchanged.

## Out of scope

The account page, the accounts list page (`accounts-list.tsx`), masonry order, and any change to how metrics are computed. The list's data (`metrics.installments`, `nextCollections`, `overdueCount`) is already enough.

## Testing

- Unit tests for `swipe-progress.ts`: height interpolation at 0, 0.5 and 1; clamping; tile and dot stagger values; reduced-motion branch.
- Manual on a phone-width viewport and a real phone: swipe tracks the finger; a tap opens the account and a swipe doesn't; long-press selects but a swipe doesn't; vertical scroll over the card works; no empty space under pane 1; each kind of account, pending, offline-pending-sync, selection mode; light and dark; reduced motion on; font scale at the largest setting; keyboard arrows and a screen reader pass.
- `tsc`, `vitest` and `next build` as before.
