/** Header band colours per kind of account, shared by the borrower page cards and the account page. */
export const TONES = {
  violet: { band: "bg-violet-100/70 dark:bg-violet-950/30" },
  amber: { band: "bg-amber-50 dark:bg-amber-950/20" },
  lime: { band: "bg-lime-100/70 dark:bg-lime-950/30" },
  cyan: { band: "bg-cyan-100/70 dark:bg-cyan-950/30" },
} as const;

export type AccountTone = keyof typeof TONES;

/** Loans violet, cash advances amber, manual flat lime, manual rolling cyan. */
export function accountTone(opts: {
  isManual: boolean;
  isRolling: boolean;
  isCashAdvance: boolean;
}): AccountTone {
  if (opts.isManual) return opts.isRolling ? "cyan" : "lime";
  return opts.isCashAdvance ? "amber" : "violet";
}

/** Coloured stat tiles: what's left, what's collected, ginansya. */
export const TILE_TONES = {
  yellow: {
    box: "border-yellow-200/80 bg-yellow-100 dark:border-yellow-900/40 dark:bg-yellow-900/25",
    label: "text-yellow-800/80 dark:text-yellow-200/70",
    value: "text-[#556477] dark:text-yellow-100",
  },
  emerald: {
    box: "border-emerald-200/80 bg-emerald-100/80 dark:border-emerald-900/40 dark:bg-emerald-900/25",
    label: "text-emerald-800/80 dark:text-emerald-200/70",
    value: "text-[#048863] dark:text-emerald-200",
  },
  teal: {
    box: "border-teal-200/80 bg-teal-100/80 dark:border-teal-900/40 dark:bg-teal-900/25",
    label: "text-teal-800/80 dark:text-teal-200/70",
    value: "text-[#0e857b] dark:text-teal-200",
  },
} as const;

/**
 * The account card's stat tiles, by position: left to pay, collected,
 * ginansya, total due. Faint fills so the band stays the card's one colour.
 */
export const SWIPE_TILE_TONES = [
  {
    box: "border-yellow-100 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-900/15",
    label: "text-yellow-800/70 dark:text-yellow-200/60",
  },
  {
    box: "border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/15",
    label: "text-emerald-800/70 dark:text-emerald-200/60",
  },
  {
    box: "border-teal-100 bg-teal-50 dark:border-teal-900/30 dark:bg-teal-900/15",
    label: "text-teal-800/70 dark:text-teal-200/60",
  },
  {
    box: "border-slate-200 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800/30",
    label: "text-slate-500 dark:text-slate-400",
  },
] as const;
