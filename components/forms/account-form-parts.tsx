"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { Minus, Plus, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatAmountInput,
  indexAfterSignificant,
  significantBefore,
} from "@/lib/checklist/amount-input";

/**
 * The building blocks of the account form: labelled fields with a coloured
 * icon, the big amount input, segmented choices with a sliding pill,
 * quick-pick chips, a number box with − / +, and the small animations they
 * share. Each field has its own colour ("tone"); the amount and the account
 * type follow the type's colour (violet for loans, amber for cash advances),
 * as on the borrower page.
 */

export type Tone =
  | "violet"
  | "amber"
  | "rose"
  | "sky"
  | "teal"
  | "orange"
  | "emerald"
  | "fuchsia"
  | "lime";

/**
 * Every class is written out, so Tailwind sees it. Selected states are
 * outlined, not filled: a coloured border and text over a faint tint.
 */
const TONES: Record<
  Tone,
  {
    /** The icon tile beside a label, and the − / + buttons. */
    tile: string;
    /** A selected chip. */
    on: string;
    /** The sliding pill of a segmented control. */
    pill: string;
    /** The label on that pill. */
    pillText: string;
    /** Border and ring of a focused box. */
    focus: string;
    /** Coloured text. */
    text: string;
    /** A tinted panel. */
    soft: string;
  }
> = {
  violet: {
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    on: "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    pill: "border border-violet-500 bg-violet-50 dark:bg-violet-900/30",
    pillText: "text-violet-700 dark:text-violet-300",
    focus: "focus-within:border-violet-500/60 focus-within:ring-violet-500/15",
    text: "text-violet-600 dark:text-violet-300",
    soft: "border-violet-500/30 bg-violet-500/10",
  },
  amber: {
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    on: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    pill: "border border-amber-500 bg-amber-50 dark:bg-amber-900/30",
    pillText: "text-amber-700 dark:text-amber-300",
    focus: "focus-within:border-amber-500/60 focus-within:ring-amber-500/15",
    text: "text-amber-600 dark:text-amber-300",
    soft: "border-amber-500/30 bg-amber-500/10",
  },
  rose: {
    tile: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    on: "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    pill: "border border-rose-500 bg-rose-50 dark:bg-rose-900/30",
    pillText: "text-rose-700 dark:text-rose-300",
    focus: "focus-within:border-rose-500/60 focus-within:ring-rose-500/15",
    text: "text-rose-600 dark:text-rose-300",
    soft: "border-rose-500/30 bg-rose-500/10",
  },
  sky: {
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    on: "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    pill: "border border-sky-500 bg-sky-50 dark:bg-sky-900/30",
    pillText: "text-sky-700 dark:text-sky-300",
    focus: "focus-within:border-sky-500/60 focus-within:ring-sky-500/15",
    text: "text-sky-600 dark:text-sky-300",
    soft: "border-sky-500/30 bg-sky-500/10",
  },
  teal: {
    tile: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
    on: "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    pill: "border border-teal-500 bg-teal-50 dark:bg-teal-900/30",
    pillText: "text-teal-700 dark:text-teal-300",
    focus: "focus-within:border-teal-500/60 focus-within:ring-teal-500/15",
    text: "text-teal-600 dark:text-teal-300",
    soft: "border-teal-500/30 bg-teal-500/10",
  },
  orange: {
    tile: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    on: "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    pill: "border border-orange-500 bg-orange-50 dark:bg-orange-900/30",
    pillText: "text-orange-700 dark:text-orange-300",
    focus: "focus-within:border-orange-500/60 focus-within:ring-orange-500/15",
    text: "text-orange-600 dark:text-orange-300",
    soft: "border-orange-500/30 bg-orange-500/10",
  },
  emerald: {
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    on: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    pill: "border border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30",
    pillText: "text-emerald-700 dark:text-emerald-300",
    focus:
      "focus-within:border-emerald-500/60 focus-within:ring-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-300",
    soft: "border-emerald-500/30 bg-emerald-500/10",
  },
  fuchsia: {
    tile: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
    on: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
    pill: "border border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30",
    pillText: "text-fuchsia-700 dark:text-fuchsia-300",
    focus:
      "focus-within:border-fuchsia-500/60 focus-within:ring-fuchsia-500/15",
    text: "text-fuchsia-600 dark:text-fuchsia-300",
    soft: "border-fuchsia-500/30 bg-fuchsia-500/10",
  },
  lime: {
    tile: "bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300",
    on: "border-lime-500 bg-lime-50 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
    pill: "border border-lime-500 bg-lime-50 dark:bg-lime-900/30",
    pillText: "text-lime-700 dark:text-lime-300",
    focus: "focus-within:border-lime-500/60 focus-within:ring-lime-500/15",
    text: "text-lime-600 dark:text-lime-300",
    soft: "border-lime-500/30 bg-lime-500/10",
  },
};

const SPRING = { type: "spring", stiffness: 500, damping: 34 } as const;

export const accountInputClass =
  "h-12 w-full min-w-0 appearance-none rounded-2xl border border-border bg-muted/40 px-4 text-[15px] font-semibold outline-none transition placeholder:font-medium placeholder:text-muted-foreground/70 focus:bg-card focus:ring-4 aria-invalid:border-red-500/70 aria-invalid:ring-red-500/10";

/** Focus colours for a plain input (the date boxes), by tone. */
export const INPUT_FOCUS: Record<"orange" | "emerald", string> = {
  orange: "focus:border-orange-500/60 focus:ring-orange-500/15",
  emerald: "focus:border-emerald-500/60 focus:ring-emerald-500/15",
};

const labelClass = "block text-xs font-bold text-muted-foreground";

/** The form's blocks rise in one after another when the sheet opens. */
export function Stagger({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <m.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.045 } } }}
    >
      {children}
    </m.div>
  );
}

export function Rise({ children }: { children: ReactNode }) {
  return (
    <m.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        shown: { opacity: 1, y: 0, transition: SPRING },
      }}
    >
      {children}
    </m.div>
  );
}

/** Opens and closes its content by height, instead of popping it in. */
export function Reveal({
  show,
  className,
  children,
}: {
  show: boolean;
  /** Spacing above the content goes here, so it collapses too. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div
          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
          animate={{
            height: "auto",
            opacity: 1,
            // The chip rows bleed past the edges, so nothing clips at rest.
            transitionEnd: { overflow: "visible" },
          }}
          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
        >
          <div className={className}>{children}</div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** A figure that rolls to its new value when it changes. */
export function Roll({ value }: { value: string }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          className="inline-block"
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={SPRING}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/** Marks a validation message; the checklist's create sheet looks for it. */
export function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.p
          data-field-error=""
          role="alert"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-1.5 px-1 text-xs font-semibold text-red-600
            dark:text-red-400"
        >
          {message}
        </m.p>
      )}
    </AnimatePresence>
  );
}

export function Field({
  id,
  label,
  icon: Icon,
  tone,
  error,
  aside,
  children,
}: {
  /** The input's id, when the label should focus it. */
  id?: string;
  label: string;
  icon?: LucideIcon;
  tone?: Tone;
  error?: string;
  /** Shown on the label's line, right-aligned (a hint or a value). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2 px-0.5">
        {Icon && tone && (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lg",
              TONES[tone].tile,
            )}
          >
            <Icon className="size-3.5" strokeWidth={2.75} />
          </span>
        )}
        {id ? (
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
        ) : (
          <span className={labelClass}>{label}</span>
        )}
        {aside && (
          <span
            className={cn(
              "ml-auto text-xs font-bold",
              tone ? TONES[tone].text : "text-primary",
            )}
          >
            {aside}
          </span>
        )}
      </div>
      {children}
      <FieldError message={error} />
    </div>
  );
}

/** The principal: a large peso input that adds commas as it is typed. */
export function HeroAmount({
  id,
  value,
  onChange,
  invalid,
  tone,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  invalid?: boolean;
  tone: Tone;
}) {
  const ref = useRef<HTMLInputElement>(null);
  /** Digits and dots before the caret, restored after the commas change. */
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || caret.current === null) return;
    const at = indexAfterSignificant(input.value, caret.current);
    caret.current = null;
    if (document.activeElement === input) input.setSelectionRange(at, at);
  });

  return (
    <label
      htmlFor={id}
      className={cn(
        `flex h-[4.5rem] items-center gap-2 rounded-3xl border px-5
        transition-colors duration-300 focus-within:ring-4`,
        invalid
          ? "border-red-500/70 bg-red-500/5 focus-within:ring-red-500/10"
          : [TONES[tone].soft, TONES[tone].focus],
      )}
    >
      <span
        className={cn(
          "text-2xl font-black transition-colors duration-300",
          TONES[tone].text,
        )}
      >
        ₱
      </span>
      {/* Inputs are held at 16px on phones (it stops iOS zooming in), so the
          big figure is a half-width input drawn at twice the size. */}
      <div className="min-w-0 flex-1">
        <input
          id={id}
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label="Principal amount"
          aria-invalid={invalid || undefined}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const input = e.target;
            caret.current = significantBefore(
              input.value,
              input.selectionStart ?? input.value.length,
            );
            onChange(formatAmountInput(input.value));
          }}
          className="ml-auto block w-1/2 origin-right scale-[2] bg-transparent
            text-right text-base font-black tracking-tight tabular-nums
            outline-none placeholder:text-muted-foreground/40"
        />
      </div>
    </label>
  );
}

/** A row of quick picks that scrolls sideways instead of wrapping. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 py-0.5
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  tone,
  className,
  children,
}: {
  selected?: boolean;
  onClick(): void;
  tone: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <m.button
      type="button"
      aria-pressed={selected ?? false}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      animate={{ scale: selected ? [1, 1.12, 1] : 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        `h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-bold
        tabular-nums transition-colors`,
        selected
          ? TONES[tone].on
          : "border-border bg-card text-muted-foreground",
        className,
      )}
    >
      {children}
    </m.button>
  );
}

/** One choice out of a few; a coloured pill slides to the chosen one. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  tone,
}: {
  /** Accessible name of the group. */
  label: string;
  value: T | undefined;
  /** An option's own tone colours the pill while it is the chosen one. */
  options: ReadonlyArray<{ value: T; label: string; tone?: Tone }>;
  onChange(value: T): void;
  tone: Tone;
}) {
  const pillId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-muted/60
        p-1"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              `relative h-10 min-w-0 rounded-xl px-1 text-[13px] font-bold
              transition-colors duration-200`,
              on
                ? TONES[option.tone ?? tone].pillText
                : "text-muted-foreground",
            )}
          >
            {on && (
              <m.span
                layoutId={pillId}
                transition={SPRING}
                className={cn(
                  "absolute inset-0 rounded-xl transition-colors duration-300",
                  TONES[option.tone ?? tone].pill,
                )}
              />
            )}
            <span className="relative block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A number typed in the middle, nudged with − and +. */
export function StepperInput({
  id,
  value,
  onChange,
  onBlur,
  onStep,
  suffix,
  label,
  tone,
  inputMode = "decimal",
  invalid,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  onBlur(): void;
  onStep(direction: 1 | -1): void;
  suffix: string;
  /** What is being stepped, for the − / + buttons' names. */
  label: string;
  tone: Tone;
  inputMode?: "decimal" | "numeric";
  invalid?: boolean;
}) {
  const step = (direction: 1 | -1) => (
    <m.button
      type="button"
      aria-label={`${direction === 1 ? "Increase" : "Decrease"} ${label}`}
      onClick={() => onStep(direction)}
      whileTap={{ scale: 0.8 }}
      className={cn(
        "m-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
        TONES[tone].tile,
      )}
    >
      {direction === 1 ? (
        <Plus className="size-4" strokeWidth={3} />
      ) : (
        <Minus className="size-4" strokeWidth={3} />
      )}
    </m.button>
  );
  return (
    <div
      className={cn(
        `flex h-12 items-center overflow-hidden rounded-2xl border bg-muted/40
        transition focus-within:bg-card focus-within:ring-4`,
        invalid
          ? "border-red-500/70 focus-within:ring-red-500/10"
          : ["border-border", TONES[tone].focus],
      )}
    >
      {step(-1)}
      <label
        htmlFor={id}
        className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5"
      >
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          placeholder="0"
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={(e) => e.currentTarget.select()}
          // As wide as what is typed, so the suffix sits right after it.
          style={{ width: `${Math.max(value.length, 1) + 0.5}ch` }}
          className="min-w-0 bg-transparent text-right text-lg font-black
            tabular-nums outline-none placeholder:text-muted-foreground/40"
        />
        <span className="text-sm font-semibold text-muted-foreground">
          {suffix}
        </span>
      </label>
      {step(1)}
    </div>
  );
}

/** An on / off switch with its label beside it (for a dark panel). */
export function SwitchRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0 text-[13px] font-semibold">{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          `flex h-7 w-12 shrink-0 items-center rounded-full p-0.5
          transition-colors duration-300`,
          checked ? "justify-end bg-white" : "justify-start bg-white/25",
        )}
      >
        <m.span
          layout
          transition={SPRING}
          className={cn(
            "size-6 rounded-full shadow transition-colors duration-300",
            checked ? "bg-emerald-600" : "bg-white",
          )}
        />
      </span>
    </button>
  );
}
