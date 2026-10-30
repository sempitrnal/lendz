"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { UseFormReturn } from "react-hook-form";
import { AnimatePresence, m } from "motion/react";
import { Check, Phone, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatContactNumber } from "@/lib/format-contact-number";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORIES_KEY, useCategories } from "@/lib/categories/use-categories";
import type { CategoryRow } from "@/lib/cache/categories";
import { supabase } from "@/lib/supabase/client";
import type { BorrowerFormValues } from "@/lib/validations/borrower";

/**
 * The add and edit borrower sheets share these: a header that shows the
 * borrower's initials as they are typed, the name and contact fields, and a
 * category picker of tap-to-toggle chips.
 */

const inputClass =
  "h-12 w-full rounded-2xl border border-border bg-muted/40 px-4 text-[15px] font-semibold outline-none transition placeholder:font-medium placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-card focus:ring-4 focus:ring-primary/10 aria-invalid:border-red-500/70 aria-invalid:ring-red-500/10";

const labelClass =
  "mb-1.5 block px-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase";

/** "Juan" "Dela Cruz" → "JD". */
function initialsOf(first: string, last: string) {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase();
}

export function BorrowerSheetHeader({
  form,
  title,
  fallback,
}: {
  form: UseFormReturn<BorrowerFormValues>;
  title: string;
  /** Under the title until a name is typed. */
  fallback: string;
}) {
  const first = form.watch("first_name") ?? "";
  const last = form.watch("last_name") ?? "";
  const initials = initialsOf(first, last);
  const name = `${first} ${last}`.trim();
  return (
    <div className="flex items-center gap-3 px-5 pt-2 pb-4">
      <span
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center
          rounded-full bg-primary text-xl font-black text-primary-foreground
          shadow-sm"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={initials || "empty"}
            initial={{ y: 10, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {initials || <Plus className="size-6" strokeWidth={2.75} />}
          </m.span>
        </AnimatePresence>
      </span>
      <div className="min-w-0">
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
        <p className="truncate text-sm font-semibold text-muted-foreground">
          {name || fallback}
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 px-1 text-xs font-semibold text-red-600">{error}</p>
      )}
    </div>
  );
}

export function BorrowerFields({
  form,
  idPrefix,
}: {
  form: UseFormReturn<BorrowerFormValues>;
  idPrefix: string;
}) {
  const {
    register,
    formState: { errors },
  } = form;
  const {
    ref: contactRef,
    onChange: contactOnChange,
    ...contactRest
  } = register("contact");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Field
          id={`${idPrefix}_first_name`}
          label="First name"
          error={errors.first_name?.message}
        >
          <input
            id={`${idPrefix}_first_name`}
            placeholder="Juan"
            autoComplete="given-name"
            autoCapitalize="words"
            aria-invalid={!!errors.first_name}
            {...register("first_name")}
            className={inputClass}
          />
        </Field>
        <Field
          id={`${idPrefix}_last_name`}
          label="Last name"
          error={errors.last_name?.message}
        >
          <input
            id={`${idPrefix}_last_name`}
            placeholder="Dela Cruz"
            autoComplete="family-name"
            autoCapitalize="words"
            aria-invalid={!!errors.last_name}
            {...register("last_name")}
            className={inputClass}
          />
        </Field>
      </div>
      <Field id={`${idPrefix}_contact`} label="Contact number">
        <div className="relative">
          <Phone
            className="pointer-events-none absolute top-1/2 left-4 size-4
              -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id={`${idPrefix}_contact`}
            ref={contactRef}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(0977) 123-4567"
            {...contactRest}
            onChange={(e) => {
              e.target.value = formatContactNumber(e.target.value);
              contactOnChange(e);
            }}
            className={cn(inputClass, "pl-10 tabular-nums")}
          />
        </div>
      </Field>
    </div>
  );
}

type CategoryOption = { id: string; name: string; color: string | null };

/** Colours a category made from the picker starts with, in turn. */
const NEW_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#ef4444",
  "#84cc16",
];

/**
 * Every category as a chip: a tap picks it or lets it go. The search box
 * narrows them, and a name that matches none can be made into a new category
 * on the spot.
 */
export function CategoryPicker({
  idPrefix,
  selected,
  onChange,
}: {
  idPrefix: string;
  selected: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
}) {
  const queryClient = useQueryClient();
  const { data, isError } = useCategories();
  // Offline with nothing saved yet: the picker shows none.
  const categories = useMemo<CategoryOption[] | null>(
    () => data ?? (isError ? [] : null),
    [data, isError],
  );
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (categories ?? []).filter((c) => !q || c.name.toLowerCase().includes(q)),
    [categories, q],
  );
  const exact = (categories ?? []).some((c) => c.name.toLowerCase() === q);
  const picked = (categories ?? []).filter((c) => selected.includes(c.id));

  const toggle = (id: string) =>
    onChange((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const create = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    const color = NEW_COLORS[(categories?.length ?? 0) % NEW_COLORS.length];
    const { data: row, error } = await supabase
      .from("categories")
      .insert({ name, color })
      .select("id, name, color")
      .single();
    setCreating(false);
    if (error || !row) {
      toast.error(error?.message ?? "Could not add the category");
      return;
    }
    queryClient.setQueryData<CategoryRow[]>(CATEGORIES_KEY, (prev) => [
      ...(prev ?? []),
      { ...(row as CategoryOption), sort_order: null, created_at: "" },
    ]);
    onChange((prev) => [...prev, row.id]);
    setQuery("");
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <p className={cn(labelClass, "mb-0")} id={`${idPrefix}_categories`}>
          Categories
        </p>
        <AnimatePresence initial={false}>
          {picked.length > 0 && (
            <m.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onChange([])}
              className="text-[11px] font-bold text-primary"
            >
              {picked.length} picked · clear
            </m.button>
          )}
        </AnimatePresence>
      </div>

      <div className="rounded-3xl border border-border bg-muted/30 p-2">
        {categories !== null && (
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4
                -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter picks the only match, or makes a new one.
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (shown.length === 1) {
                  toggle(shown[0].id);
                  setQuery("");
                } else if (q && !exact) void create();
              }}
              placeholder="Find or add a category"
              aria-label="Find or add a category"
              className="h-10 w-full rounded-2xl border border-border bg-card
                pr-9 pl-9 text-sm font-medium outline-none
                placeholder:text-muted-foreground/70 focus:border-primary/60
                [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2
                  items-center justify-center rounded-full text-muted-foreground
                  hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        <div
          role="group"
          aria-labelledby={`${idPrefix}_categories`}
          className="flex max-h-60 flex-wrap gap-1.5 overflow-y-auto
            [scrollbar-width:none] overscroll-contain p-0.5"
        >
          {categories === null &&
            [64, 92, 76, 104, 70, 88].map((w, i) => (
              <span
                key={i}
                className="h-9 animate-pulse rounded-full bg-muted"
                style={{ width: w }}
              />
            ))}
          {shown.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                style={{ "--cat": c.color ?? "#94a3b8" } as React.CSSProperties}
                className={cn(
                  `flex h-9 max-w-full items-center gap-1.5 rounded-full border
                  pr-3 pl-1.5 text-[13px] font-semibold lowercase transition-all
                  duration-150 active:scale-95`,
                  on
                    ? `border-(--cat)
                      bg-[color-mix(in_oklab,var(--cat)_20%,var(--card))]
                      text-foreground shadow-sm`
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    `flex size-5.5 shrink-0 items-center justify-center
                    rounded-full bg-(--cat) ring-1 ring-black/10 ring-inset
                    transition-transform`,
                    on ? "scale-100" : "scale-[0.45]",
                  )}
                  aria-hidden="true"
                >
                  {on && (
                    <Check
                      className="size-3.5 text-white
                        drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                      strokeWidth={3.5}
                    />
                  )}
                </span>
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
          {q && !exact && categories !== null && (
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="flex h-9 items-center gap-1.5 rounded-full border
                border-dashed border-primary/60 px-3.5 text-sm font-bold
                text-primary transition active:scale-95 disabled:opacity-50"
            >
              <Plus className="size-4" strokeWidth={2.75} />
              {creating ? "adding…" : `add “${query.trim()}”`}
            </button>
          )}
          {categories !== null && categories.length === 0 && !q && (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              No categories yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
