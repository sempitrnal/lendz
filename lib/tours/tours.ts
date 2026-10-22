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
];
