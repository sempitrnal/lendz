import { Clock, HandCoins, Landmark, type LucideIcon } from "lucide-react";

/** Badge colours and icon for each group heading on the borrower page, and its account rows. */
export const GROUP_STYLES: Record<string, { icon: LucideIcon; badge: string }> = {
  loans: {
    icon: Landmark,
    badge:
      "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-100 dark:ring-violet-800",
  },
  "manual flat loans": {
    icon: Landmark,
    badge:
      "bg-lime-100 text-lime-800 ring-lime-200 dark:bg-lime-900/40 dark:text-lime-100 dark:ring-lime-800",
  },
  "manual rolling loans": {
    icon: Landmark,
    badge:
      "bg-cyan-100 text-cyan-800 ring-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100 dark:ring-cyan-800",
  },
  "cash advances": {
    icon: HandCoins,
    badge:
      "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800",
  },
  "manual flat cash advances": {
    icon: HandCoins,
    badge:
      "bg-yellow-100 text-yellow-800 ring-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100 dark:ring-yellow-800",
  },
  "manual rolling cash advances": {
    icon: HandCoins,
    badge:
      "bg-teal-100 text-teal-800 ring-teal-200 dark:bg-teal-900/40 dark:text-teal-100 dark:ring-teal-800",
  },
  pending: {
    icon: Clock,
    badge:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800",
  },
  "manual flat pending": {
    icon: Clock,
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800",
  },
  "manual rolling pending": {
    icon: Clock,
    badge:
      "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-200 dark:ring-cyan-800",
  },
};
