"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { Check, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Sheet, SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import {
  BORROWERS_SEARCH_KEY,
  useBorrowersSearch,
} from "@/hooks/use-borrowers-search";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import type { Borrower } from "../borrower/borrower-list";

type AssignBorrowerProps = {
  categoryId: string;
  categoryName?: string;
  categoryColor?: string | null;
  initialAssigned?: Borrower[];
};

const fullName = (b: { first_name: string; last_name: string }) =>
  `${b.first_name} ${b.last_name}`.trim();

/** "jamielyn ponteras" → "JP". */
function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")
  ).toUpperCase();
}

/** A borrower's categories, whichever shape the join came back in. */
function categoriesOf(b: BorrowerSearchItem) {
  return (b.borrower_categories ?? []).flatMap((row) =>
    Array.isArray(row.category)
      ? row.category
      : row.category
        ? [row.category]
        : [],
  );
}

/**
 * The + on a category's band: a sheet listing every borrower, where a tap
 * puts one in the category or takes them out. Saving changes only the ones
 * that moved.
 */
export default function AssignBorrower({
  categoryId,
  categoryName,
  categoryColor,
  initialAssigned = [],
}: AssignBorrowerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seq, setSeq] = useState(0);

  return (
    <>
      <button
        type="button"
        aria-label="Assign borrowers"
        onClick={() => {
          setSeq((n) => n + 1);
          setOpen(true);
        }}
        className="relative flex size-9 shrink-0 items-center justify-center
          rounded-full bg-white text-emerald-600 shadow-sm transition-transform
          active:scale-90"
      >
        <Plus className="size-5" />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label="Assign borrowers"
      >
        <AssignSheet
          key={seq}
          categoryId={categoryId}
          categoryName={categoryName}
          categoryColor={categoryColor}
          initialIds={initialAssigned.map((b) => b.id)}
          onDone={() => {
            setOpen(false);
            void queryClient.invalidateQueries({
              queryKey: BORROWERS_SEARCH_KEY,
            });
            router.refresh();
          }}
        />
      </Sheet>
    </>
  );
}

function AssignSheet({
  categoryId,
  categoryName,
  categoryColor,
  initialIds,
  onDone,
}: {
  categoryId: string;
  categoryName?: string;
  categoryColor?: string | null;
  initialIds: string[];
  onDone(): void;
}) {
  const { data: borrowers, isLoading } = useBorrowersSearch();
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [query, setQuery] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = query.trim().toLowerCase();
  // Who is already in comes first; the order holds while you tick, so rows
  // never jump under your finger.
  const rows = useMemo(() => {
    const start = new Set(initialIds);
    return [...(borrowers ?? [])]
      .filter((b) => !q || fullName(b).toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(start.has(b.id)) - Number(start.has(a.id)) ||
          fullName(a).localeCompare(fullName(b)),
      );
  }, [borrowers, q, initialIds]);
  const shown = onlyPicked ? rows.filter((b) => selected.includes(b.id)) : rows;

  const added = selected.filter((id) => !initialIds.includes(id));
  const removed = initialIds.filter((id) => !selected.includes(id));
  const changed = added.length + removed.length;

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const save = async () => {
    setSaving(true);
    if (removed.length > 0) {
      const { error } = await supabase
        .from("borrower_categories")
        .delete()
        .eq("category_id", categoryId)
        .in("borrower_id", removed);
      if (error) {
        setSaving(false);
        triggerHaptic("error");
        toast.error(error.message);
        return;
      }
    }
    if (added.length > 0) {
      const { error } = await supabase.from("borrower_categories").insert(
        added.map((borrower_id) => ({
          borrower_id,
          category_id: categoryId,
        })),
      );
      if (error) {
        setSaving(false);
        triggerHaptic("error");
        toast.error(error.message);
        return;
      }
    }
    setSaving(false);
    triggerHaptic("success");
    toast.success(
      [
        added.length && `${added.length} added`,
        removed.length && `${removed.length} removed`,
      ]
        .filter(Boolean)
        .join(", "),
    );
    onDone();
  };

  return (
    <div>
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-center gap-2">
          <span
            className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: categoryColor ?? "#94a3b8" }}
            aria-hidden="true"
          />
          <p
            className="truncate text-[11px] font-bold tracking-wider
              text-muted-foreground uppercase"
          >
            {categoryName ?? "Category"}
          </p>
        </div>
        <h2 className="mt-0.5 text-xl font-black tracking-tight">
          Assign borrowers
        </h2>
      </div>

      {/* Search and the picked count stay put while the list scrolls. */}
      <div className="sticky top-0 z-10 space-y-2 bg-card px-5 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4
              -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search borrowers"
            aria-label="Search borrowers"
            className="h-12 w-full rounded-2xl border border-border bg-muted/40
              pr-10 pl-10 text-[15px] font-semibold outline-none
              placeholder:font-medium placeholder:text-muted-foreground/70
              focus:border-primary/60 focus:bg-card focus:ring-4
              focus:ring-primary/10 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2
                items-center justify-center rounded-full text-muted-foreground
                hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(
            [
              [false, `everyone`],
              [true, `picked ${selected.length}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={onlyPicked === value}
              onClick={() => setOnlyPicked(value)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-bold transition",
                onlyPicked === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <AnimatePresence>
            {changed > 0 && (
              <m.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="ml-auto text-[11px] font-bold text-primary"
              >
                {[
                  added.length && `+${added.length}`,
                  removed.length && `−${removed.length}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </m.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ul className="space-y-1 px-3 pb-3">
        {isLoading &&
          Array.from({ length: 6 }, (_, i) => (
            <li
              key={i}
              className="mx-2 h-14 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        {shown.map((b) => {
          const on = selected.includes(b.id);
          const all = categoriesOf(b);
          const cats = all.filter((c) => c.id !== categoryId);
          const color = all.find((c) => c.color)?.color ?? "#94a3b8";
          const name = fullName(b);
          return (
            <li key={b.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(b.id)}
                style={{ "--cat": color } as React.CSSProperties}
                className={cn(
                  `flex w-full items-center gap-3 rounded-2xl px-2 py-2
                  text-left transition active:scale-[0.98]`,
                  on ? "bg-primary/10" : "hover:bg-muted/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center
                    rounded-full
                    bg-[color-mix(in_oklab,var(--cat)_22%,var(--card))] text-xs
                    font-black
                    text-[color-mix(in_oklab,var(--cat)_45%,var(--foreground))]"
                >
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold lowercase">
                    {name}
                  </span>
                  <span
                    className="block truncate text-[11px] font-semibold
                      text-muted-foreground lowercase"
                  >
                    {cats.length > 0
                      ? `also in ${cats.map((c) => c.name).join(", ")}`
                      : "no other category"}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    `flex size-6 shrink-0 items-center justify-center
                    rounded-full border-2 transition-colors`,
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {on && <Check className="size-3.5" strokeWidth={3.5} />}
                </span>
              </button>
            </li>
          );
        })}
        {!isLoading && shown.length === 0 && (
          <li
            className="px-4 py-10 text-center text-sm font-semibold
              text-muted-foreground"
          >
            {onlyPicked
              ? "Nobody picked yet."
              : `No borrower matches “${query.trim()}”.`}
          </li>
        )}
      </ul>

      <SheetFooter>
        <Button
          type="button"
          size="lg"
          disabled={saving || changed === 0}
          onClick={save}
          className="h-12 w-full rounded-2xl text-base font-bold"
        >
          {saving
            ? "Saving…"
            : changed === 0
              ? "No changes"
              : `Save ${changed} change${changed === 1 ? "" : "s"}`}
        </Button>
      </SheetFooter>
    </div>
  );
}
