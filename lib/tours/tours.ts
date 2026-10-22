import type { Tour } from "@/lib/tours/logic";

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
    id: "2026-10-22-release-accounts",
    title: "Open a created release",
    date: "2026-10-22",
    page: "/daily-checklist",
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
];
