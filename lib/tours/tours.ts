import type { Tour } from "@/lib/tours/logic";

/**
 * The whole-checklist walkthrough. It plays once by itself on the first visit
 * after the deploy that added it, and can be started again from the "⋯" menu
 * or What's new.
 */
export const GUIDE_TOUR_ID = "2026-10-22-checklist-guide";

/**
 * Every What's new tour, oldest first. Shipping a change means adding a tour
 * here and the `data-tour` attributes it points at. A released tour is never
 * edited; a follow-up change gets a new one.
 */
export const TOURS: Tour[] = [
  {
    id: "2026-10-22-checklist",
    title: "Checklist update",
    date: "2026-10-22",
    page: "/daily-checklist",
    // The guide covers this; it stays here to replay, but no longer starts by itself.
    auto: false,
    steps: [
      {
        target: '[data-tour="checklist-tabs"]',
        title: "Collect and Release",
        body: "Switch tabs here. The tab and the day are in the address, so you can reload or share a link and land in the same place.",
      },
      {
        target: '[data-tour="checklist-multi-row"]',
        title: "Several schedules",
        body: "Tap the borrower's row to see every schedule they owe, including paid ones.",
      },
      {
        target: '[data-tour="checklist-pay-pill"]',
        title: "Pay and review",
        body: "Opens the payment sheet. Tap an account's card in it to open that account.",
      },
    ],
  },
  {
    id: GUIDE_TOUR_ID,
    title: "Checklist guide",
    date: "2026-10-22",
    page: "/daily-checklist",
    steps: [
      {
        target: '[data-tour="checklist-date"]',
        title: "Pick the day",
        body: "Use the arrows, or tap the date to pick any day. Each day has its own list. It keeps working offline: changes wait and sync when you reconnect.",
      },
      {
        target: '[data-tour="checklist-summary"]',
        title: "What's left to collect",
        body: "The total still to collect on this day, how many are paid, and a progress bar.",
      },
      {
        target: '[data-tour="checklist-release-tab"]',
        title: "Collect and Release",
        body: "Collect is what borrowers owe you. Release is money you gave out. Tap Release to see it.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="release-row"]',
        title: "Turn a release into an account",
        body: "Each release is read from its note. Create account opens a form already filled in. Once it's made it shows Created, and tapping it opens the account.",
        lazy: true,
      },
      {
        target: '[data-tour="release-new"]',
        title: "Add a release",
        body: "Type the amount, the months and the dates in one note and it fills the form for you.",
        lazy: true,
      },
      {
        target: '[data-tour="checklist-collect-tab"]',
        title: "Back to Collect",
        body: "Tap Collect to go back.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="checklist-filters"]',
        title: "Filter the list",
        body: "Show only what's overdue, due today, or already paid. Try one later; All clears it.",
      },
      {
        target: '[data-tour="checklist-add"]',
        title: "Add an item",
        body: "Tap + to open the add sheet.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="add-note"]',
        title: "Type a note",
        body: "Type @ to mention a borrower, or /next to pick that borrower's next dues and link them as a collection row. Nothing is added until you save. Tap Next to close this.",
        lazy: true,
        closesSheet: true,
      },
      {
        target: '[data-tour="checklist-menu"]',
        title: "The list menu",
        body: "Tap ⋯ to open the list menu.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="list-menu-entries"]',
        title: "Populate and more",
        body: "Populate due adds everyone due today or still unpaid from earlier days. You can also mark everything paid, undo a populate, or clear the list. Populate also runs by itself every morning, and a summary of what it added shows when you open the app. Tap Next to close this.",
        lazy: true,
        closesSheet: true,
      },
      {
        target: '[data-tour="checklist-group"]',
        title: "Groups by category",
        body: "Rows are grouped by the borrower's category. Tap a header to collapse it.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="checklist-group"]',
        title: "Open it again",
        body: "Tap the header again to bring the group back. It shows how many are paid and how much is left. Anything only from earlier days sits in the Carried over section.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="checklist-name"]',
        title: "Open the borrower",
        body: "Tap a name to open that borrower's page.",
      },
      {
        target: '[data-tour="checklist-check"]',
        title: "One tap to mark paid",
        body: "The circle marks a row paid in full. A toast at the top lets you undo it. We'll leave it alone for now so nothing gets recorded.",
      },
      {
        target: '[data-tour="checklist-row"]',
        title: "Swipe for more",
        body: "Try it: swipe this row to the left to reveal More. From there you can edit it, open the borrower, or remove it from the list (with undo). Then tap Next.",
        interactive: true,
      },
      {
        target: '[data-tour="checklist-expand"]',
        title: "Several schedules",
        body: "A borrower with several schedules shows how many are due. Tap the arrow to see each one.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="checklist-lines"]',
        title: "Pay one or all",
        body: "Each schedule has its own check to pay it on its own, or use Pay all. Tap a schedule to open its payment sheet.",
        lazy: true,
      },
      {
        target: '[data-tour="checklist-pay-pill"]',
        title: "Open the payment sheet",
        body: "Tap Pay to open the payment sheet.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="pay-account-card"]',
        title: "The account card",
        body: "Each account shows its progress. Tap the card to open that account's page.",
        lazy: true,
      },
      {
        target: '[data-tour="pay-schedule-actions"]',
        title: "Paid, partial or undo",
        body: "Choose Paid, or Partial and type the amount. A schedule that's already paid has Undo. Then confirm at the bottom.",
        lazy: true,
      },
      {
        target: '[data-tour="pay-cancel"]',
        title: "Nothing changes until you confirm",
        body: "Tap Cancel to close the sheet without saving.",
        advanceOn: "click",
        lazy: true,
      },
    ],
  },
  {
    id: "2026-10-22-release-accounts",
    title: "Open a created release",
    date: "2026-10-22",
    page: "/daily-checklist",
    // The guide covers this; it stays here to replay, but no longer starts by itself.
    auto: false,
    replayQuery: "tab=release",
    steps: [
      {
        target: '[data-tour="release-created-row"]',
        title: "Created releases open the account",
        body: "Tap a release marked Created to jump to the account it made.",
      },
    ],
  },
  {
    id: "2026-10-22-borrower-accounts",
    title: "Open an account",
    date: "2026-10-22",
    page: "/borrowers/*",
    // The borrower page guide covers this; it stays here to replay, but no
    // longer starts by itself.
    auto: false,
    steps: [
      {
        target: '[data-tour="account-card"]',
        title: "The whole card opens the account",
        body: "Tap anywhere on an account card, including the coloured band at the top, to open it.",
      },
    ],
  },
  {
    id: "2026-10-22-payment-accounts",
    title: "Open an account from the payment sheet",
    date: "2026-10-22",
    page: "/daily-checklist",
    // The guide covers this; it stays here to replay, but no longer starts by itself.
    auto: false,
    steps: [
      {
        target: '[data-tour="checklist-pay-pill"]',
        title: "Open the payment sheet",
        body: "Tap Pay to open the payment sheet.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="pay-account-card"]',
        title: "Tap the account card",
        body: "Tap the card with the progress bar to open that account's page.",
        advanceOn: "click",
        lazy: true,
      },
    ],
  },
  {
    id: "2026-10-29-checklist-search",
    title: "Search the checklist",
    date: "2026-10-29",
    page: "/daily-checklist",
    steps: [
      {
        target: '[data-tour="checklist-search"]',
        title: "Search the list",
        body: "With a long list, tap the magnifier to find someone fast.",
        advanceOn: "click",
      },
      {
        target: '[data-tour="checklist-search-field"]',
        title: "Type a name or note",
        body: "The list narrows as you type, carried-over rows included. It works with the filters. Try it, then tap Done.",
        interactive: true,
        lazy: true,
      },
    ],
  },
  {
    id: "2026-10-29-carried-folded",
    title: "Carried over starts folded",
    date: "2026-10-29",
    page: "/daily-checklist",
    steps: [
      {
        target: '[data-tour="checklist-carried"]',
        title: "Carried over",
        body: "With this many carry-overs, each category now starts folded. The header still shows how many are paid and how much is left. Tap it to hide the whole section.",
      },
      {
        target: '[data-tour="checklist-carried-groups"]',
        title: "Open a category",
        body: "Tap a category to open it. Opening one doesn't open the others. A search opens them all.",
        advanceOn: "click",
      },
    ],
  },
  {
    id: "2026-10-29-borrower-page",
    title: "The borrower page, redone",
    date: "2026-10-29",
    page: "/borrowers/*",
    // The borrower page guide covers this; it stays here to replay, but no
    // longer starts by itself.
    auto: false,
    steps: [
      {
        target: '[data-tour="borrower-balance"]',
        title: "What's left, up top",
        body: "The green band leads with what the borrower still owes, how much is collected and what's due next. The eye hides the amounts. Scroll and the band folds into a header with their name, menu and profit and this-month figures.",
      },
      {
        target: '[data-tour="account-card"]',
        title: "Swipe an account",
        body: "Swipe a row to the left for Edit, Revert and Delete. The three-dot menu is gone.",
      },
    ],
  },
  {
    id: "2026-10-29-borrower-guide",
    title: "The borrower page",
    date: "2026-10-29",
    page: "/borrowers/*",
    steps: [
      {
        target: '[data-tour="borrower-balance"]',
        title: "What they still owe",
        body: "The green band leads with the remaining balance, how much of it is collected, and pills for what you loaned, what's due next and how many are overdue. The eye hides every amount on the page.",
      },
      {
        target: '[data-tour="borrower-header"]',
        title: "The header stays with you",
        body: "Their name, categories and the ⋯ menu (edit or delete the borrower) stay put. Scroll down and the band folds up into this header, which then shows profit due and made, and what they owe and have paid this month.",
      },
      {
        target: '[data-tour="account-card"]',
        title: "Swipe an account",
        body: "Try it: swipe a row to the left for Edit, Revert last update and Delete. Tap a row to open the account; press and hold to select several. Then tap Next.",
        interactive: true,
      },
      {
        target: '[data-tour="borrower-add"]',
        title: "Add a loan",
        body: "The + add button on the accounts card adds a new loan or cash advance for this borrower. Notes have the same button on their card.",
      },
    ],
  },
];
