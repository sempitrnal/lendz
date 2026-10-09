"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Settings,
  Check,
  Trash2,
  ChevronDown,
  Pencil,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type {
  ChecklistCategory,
  DailyChecklistItem,
  DueChecklistGroup,
} from "@/lib/checklist/types";
import {
  buildDueLabel,
  extractScheduleRefs,
  type NextCollectionItem,
} from "@/lib/checklist/labels";
import { summarizeChecklist } from "@/lib/checklist/totals";
import { overdueCutoffDateValue, todayDateValue } from "@/lib/checklist/dates";
import {
  ChecklistInput,
  type ChecklistInputHandle,
} from "@/components/dashboard/checklist/checklist-input";
import { LinkedLabel } from "@/components/dashboard/checklist/checklist-label";
import {
  BulkPaidDialog,
  ScheduleCheckDialog,
} from "@/components/dashboard/checklist/payment-dialogs";

/** Lighten a hex color to a soft tint on white */
function tintColor(hex: string, opacity = 0.08): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c * opacity + 255 * (1 - opacity));
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

/** Darken a hex color by mixing with dark surface (#161b22) */
function darkTintColor(hex: string, opacity = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const bgR = 22,
    bgG = 27,
    bgB = 34;
  const blend = (c: number, bg: number) =>
    Math.round(c * opacity + bg * (1 - opacity));
  return `rgb(${blend(r, bgR)}, ${blend(g, bgG)}, ${blend(b, bgB)})`;
}

function formatChecklistDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function readableColor(hex: string, isDark: boolean): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (isDark) {
    // In dark mode, lighten the color for readability
    const lighten = (c: number) => Math.round(c + (255 - c) * 0.3);
    return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
  }
  // In light mode, darken for readability
  if (luminance > 0.6) {
    const darken = (c: number) => Math.round(c * 0.55);
    return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
  }
  return hex;
}

function CategorySection({
  category,
  items,
  date,
  onAdd,
  onToggle,
  onDelete,
  onEditLabel,
  onPopulate,
  onUndoPopulate,
  onCheckMany,
}: {
  category: ChecklistCategory | null;
  items: DailyChecklistItem[];
  date: string;
  onAdd: (
    label: string,
    categoryId: string | null,
    date: string,
  ) => Promise<void>;
  onToggle: (item: DailyChecklistItem) => void;
  onDelete: (id: string) => void;
  onEditLabel: (itemId: string, newLabel: string) => void;
  onPopulate: (categoryId: string | null, date: string) => Promise<void>;
  onUndoPopulate?: () => void;
  onCheckMany: (ids: string[]) => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyChecklistItem | null>(
    null,
  );
  const [editLabelValue, setEditLabelValue] = useState("");
  const [scheduleCheckItem, setScheduleCheckItem] =
    useState<DailyChecklistItem | null>(null);
  const addInputRef = useRef<ChecklistInputHandle>(null);
  const editInputRef = useRef<ChecklistInputHandle>(null);
  const [expanded, setExpanded] = useState(true);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { data: borrowers = [] } = useBorrowersSearch();

  const getBorrowerNextAmounts = useCallback(
    async (borrowerId: string): Promise<NextCollectionItem[]> => {
      try {
        const res = await fetch(`/api/borrowers/${borrowerId}/details`);
        if (!res.ok) return [];
        const data = (await res.json()) as {
          accounts: Array<Record<string, unknown>>;
          metrics: Record<string, Record<string, unknown>>;
        };
        const items: NextCollectionItem[] = [];
        for (const a of data.accounts) {
          if (
            a.schedule_mode === "manual" ||
            (a.type !== "loan" && a.type !== "cash_advance")
          )
            continue;
          const m = data.metrics[a.id as string];
          const collections =
            (m?.dueCollections as NextCollectionItem[] | undefined) ?? [];
          for (const c of collections) {
            const amount = Number(c.amount ?? 0);
            const due_date = String(c.due_date ?? "").slice(0, 10);
            if (amount <= 0 || !due_date) continue;
            items.push({
              id: String((c as { id?: unknown }).id ?? ""),
              due_date,
              amount,
              type: String(a.type ?? ""),
            });
          }
        }
        const overdueCutoff = overdueCutoffDateValue();
        items.sort((a, b) => {
          const overdueDiff =
            (a.due_date < overdueCutoff ? 0 : 1) -
            (b.due_date < overdueCutoff ? 0 : 1);
          if (overdueDiff !== 0) return overdueDiff;
          const byDate = a.due_date.localeCompare(b.due_date);
          if (byDate !== 0) return byDate;
          return a.type.localeCompare(b.type);
        });
        return items;
      } catch {
        return [];
      }
    },
    [],
  );

  const checkedCount = items.filter((i) => i.is_checked).length;
  const totals = useMemo(() => summarizeChecklist(items), [items]);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.created_at.localeCompare(a.created_at);
      }),
    [items],
  );

  const bulkItems = useMemo(
    () =>
      sorted.filter(
        (i) => !i.is_checked && extractScheduleRefs(i.label).length > 0,
      ),
    [sorted],
  );

  const handleAdd = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAdd(trimmed, category?.id ?? null, date);
    setSaving(false);
    setNewLabel("");
    addInputRef.current?.clear();
  };

  const handleEditSave = (value: string) => {
    if (!editingItem) return;
    const trimmed = value.trim();
    if (trimmed) onEditLabel(editingItem.id, trimmed);
    setEditingItem(null);
    setEditLabelValue("");
  };

  const handleToggle = (item: DailyChecklistItem) => {
    if (!item.is_checked) {
      const refs = extractScheduleRefs(item.label);
      if (refs.length > 0) {
        setScheduleCheckItem(item);
        return;
      }
    }
    onToggle(item);
  };

  useEffect(() => {
    if (editingItem) setEditLabelValue(editingItem.label);
  }, [editingItem]);

  const catColor = category?.color;
  const bgColor = catColor
    ? isDark
      ? darkTintColor(catColor, 0.08)
      : tintColor(catColor, 0.05)
    : undefined;
  const pillBg = catColor
    ? isDark
      ? darkTintColor(catColor, 0.2)
      : tintColor(catColor, 0.12)
    : undefined;
  const pillText = catColor ? readableColor(catColor, isDark) : undefined;
  const pillBorder = catColor
    ? isDark
      ? `${catColor}30`
      : `${catColor}25`
    : undefined;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/50
        bg-white shadow-sm transition-all duration-200 dark:bg-background/80 ${
          pillBorder ? "border-l-4" : ""
        } ${expanded && items.length > 0 ? "min-h-[26rem]" : ""}`}
      style={{
        borderLeftColor: pillBorder ?? undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 transition-colors
          hover:bg-slate-50 dark:hover:bg-muted/40"
      >
        {category ? (
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2.5
              py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: pillBg ?? undefined,
              color: pillText ?? undefined,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: pillBorder ?? undefined,
            }}
          >
            {category.name}
          </span>
        ) : (
          <span
            className="dark:bg-muted dark:text-muted-foreground inline-flex
              shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-0.5
              text-xs font-semibold text-slate-500"
          >
            Uncategorized
          </span>
        )}
        <span
          className="dark:bg-muted dark:text-muted-foreground rounded-full
            bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500
            tabular-nums"
        >
          {checkedCount}/{items.length}
        </span>
        {totals.collections > 0 && (
          <span
            className="dark:text-muted-foreground text-[10px] font-medium
              text-slate-400 tabular-nums"
          >
            ₱{totals.left.toLocaleString()} left
          </span>
        )}
        <ChevronDown
          className={`dark:text-muted-foreground ml-auto size-4 text-slate-400
            transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <>
          <div
            className="mb-2 flex flex-col gap-2 px-3 sm:flex-row sm:items-start
              sm:px-4"
          >
            <div className="min-w-0 flex-1">
              <ChecklistInput
                ref={addInputRef}
                defaultValue=""
                onChange={setNewLabel}
                onSubmit={handleAdd}
                placeholder={`Add item${category ? ` to ${category.name}` : ""}…`}
                borrowers={borrowers}
                getBorrowerNextAmounts={getBorrowerNextAmounts}
                showPesoButton
              />
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addInputRef.current?.submit()}
              disabled={saving || !newLabel.trim()}
              className="shrink-0 w-full rounded-lg border border-slate-200
                bg-white px-4 py-2 text-xs font-semibold text-slate-700
                transition-all duration-200 hover:bg-slate-100
                hover:text-slate-900 disabled:opacity-50 dark:border-border/50
                dark:bg-muted dark:text-foreground dark:hover:bg-muted/80
                sm:w-auto"
            >
              {saving ? "Adding…" : "Add item"}
            </button>
          </div>
          <div className="mb-4 flex items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              title="Add everyone with a collection due on this date"
              disabled={populating}
              onClick={async () => {
                setPopulating(true);
                await onPopulate(category?.id ?? null, date);
                setPopulating(false);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5
                text-xs font-semibold text-slate-600 transition-all duration-200
                hover:bg-slate-100 disabled:opacity-50 dark:border-border/50
                dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
            >
              {populating ? "Loading…" : "Populate due"}
            </button>
            {bulkItems.length > 0 && (
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold
                  text-emerald-600 transition-colors duration-200
                  hover:bg-emerald-50 dark:text-emerald-300
                  dark:hover:bg-emerald-900/20"
              >
                Mark all paid ({bulkItems.length})
              </button>
            )}
            {onUndoPopulate && (
              <button
                type="button"
                onClick={onUndoPopulate}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold
                  text-rose-500 transition-colors duration-200 hover:bg-rose-50
                  dark:hover:bg-rose-900/20"
              >
                Undo populate
              </button>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="px-3 sm:px-4">
              <div
                className="dark:bg-muted/20 flex flex-col items-center gap-2
                  rounded-xl border border-dashed border-border/50
                  bg-slate-50/50 py-8 text-center dark:text-muted-foreground"
              >
                <p className="text-sm text-slate-500 dark:text-muted-foreground">
                  No items in this category yet.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2 px-3 pb-4 sm:px-4">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  onClick={() => handleToggle(item)}
                  className={`group flex cursor-pointer items-center gap-3
                    rounded-xl border px-3 py-2.5 transition-all duration-200 ${
                      item.is_checked
                        ? `border-border/30 bg-slate-50 dark:border-border/30
                          dark:bg-muted/20`
                        : `border-border/50 bg-white shadow-sm hover:bg-slate-50
                          dark:border-border/50 dark:bg-card
                          dark:hover:bg-muted/50`
                    }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(item);
                    }}
                    title={item.is_checked ? "Uncheck" : "Check"}
                    className={`flex size-5 shrink-0 items-center justify-center
                      rounded-full border-2 p-0 transition-all duration-200 ${
                        item.is_checked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : `border-slate-300 text-transparent
                            hover:border-emerald-400 dark:border-slate-600`
                      }`}
                    aria-label={item.is_checked ? "Uncheck" : "Check"}
                  >
                    <Check className="size-2.5" strokeWidth={2} />
                  </button>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <span
                      className={`block text-sm font-medium break-words
                        whitespace-pre-wrap transition-all duration-200 ${
                          item.is_checked
                            ? "text-slate-400 dark:text-muted-foreground/60"
                            : "text-slate-700 dark:text-foreground"
                        }`}
                    >
                      <LinkedLabel
                        label={item.label}
                        checked={item.is_checked}
                        borrowers={borrowers}
                      />
                    </span>
                    <span
                      className="block text-[10px] text-slate-400
                        dark:text-muted-foreground/60"
                    >
                      {formatChecklistDate(item.created_at)}
                    </span>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenFor(
                          menuOpenFor === item.id ? null : item.id,
                        );
                      }}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400
                        transition-colors duration-200 hover:bg-slate-100
                        hover:text-slate-600 dark:text-muted-foreground
                        dark:hover:bg-muted/60 dark:hover:text-foreground"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {menuOpenFor === item.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenFor(null);
                          }}
                        />
                        <div
                          className="absolute right-0 top-full z-50 mt-1 flex
                            flex-col gap-0.5 rounded-xl border border-border/50
                            bg-background p-1 shadow-lg dark:bg-card"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setEditLabelValue(item.label);
                              setMenuOpenFor(null);
                            }}
                            className="flex items-center gap-2 rounded-lg px-3
                              py-1.5 text-xs font-medium text-slate-600
                              transition-colors duration-200 hover:bg-slate-100
                              dark:text-muted-foreground dark:hover:bg-muted/60
                              dark:hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(item.id);
                              setMenuOpenFor(null);
                            }}
                            className="flex items-center gap-2 rounded-lg px-3
                              py-1.5 text-xs font-medium text-rose-500
                              transition-colors duration-200 hover:bg-rose-50
                              dark:hover:bg-rose-900/20
                              dark:hover:text-rose-400"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Dialog
        open={!!editingItem}
        onOpenChange={(v) => {
          if (!v) setEditingItem(null);
        }}
      >
        <DialogContent
          className="overflow-visible! sm:max-w-md"
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement).closest("[data-next-dropdown]")) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="gap-3 pb-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full
                bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40
                dark:text-indigo-300"
            >
              <Pencil className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Edit Item
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update the label for this checklist item.
              </DialogDescription>
            </div>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 pt-2">
              <div>
                <label
                  className="dark:text-muted-foreground mb-1.5 block text-xs
                    font-medium text-slate-500"
                >
                  Label
                </label>
                <ChecklistInput
                  key={editingItem.id}
                  ref={editInputRef}
                  defaultValue={editingItem.label}
                  onChange={setEditLabelValue}
                  onSubmit={handleEditSave}
                  placeholder="Edit item label…"
                  borrowers={borrowers}
                  getBorrowerNextAmounts={getBorrowerNextAmounts}
                  showPesoButton
                />
                <button
                  type="button"
                  onClick={() => editInputRef.current?.openNext()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg
                    border border-slate-200 bg-white px-3 py-1.5 text-xs
                    font-semibold text-slate-600 transition-colors
                    hover:bg-slate-100 dark:border-border/50 dark:bg-muted
                    dark:text-foreground dark:hover:bg-muted/80"
                >
                  <Plus className="size-3.5" />
                  Add / remove collections
                </button>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => editInputRef.current?.submit()}
                  disabled={!editLabelValue.trim()}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BulkPaidDialog
        items={bulkOpen ? bulkItems : null}
        categoryName={category?.name ?? "this category"}
        onClose={() => setBulkOpen(false)}
        onConfirmed={(ids) => {
          setBulkOpen(false);
          onCheckMany(ids);
        }}
      />

      <ScheduleCheckDialog
        item={scheduleCheckItem}
        onClose={() => setScheduleCheckItem(null)}
        onConfirmed={() => {
          const item = scheduleCheckItem;
          setScheduleCheckItem(null);
          if (item) onToggle(item);
        }}
      />
    </div>
  );
}

export default function DailyNotesWidget() {
  const [items, setItems] = useState<DailyChecklistItem[]>([]);
  const itemsRef = useRef<DailyChecklistItem[]>([]);
  const [lastPopulate, setLastPopulate] = useState<{
    date: string;
    categoryId: string | null;
    rows: { id: string; label: string }[];
  } | null>(null);
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [date, setDate] = useState(todayDateValue());
  const [loading, setLoading] = useState(true);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("daily_checklist_categories")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((data ?? []) as ChecklistCategory[]);
  };

  const loadItems = async (targetDate: string, withLoading = true) => {
    if (withLoading) setLoading(true);
    const { data, error } = await supabase
      .from("daily_checklist_items")
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id, daily_checklist_categories(id, name, color, sort_order)",
      )
      .eq("checklist_date", targetDate)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      if (withLoading) setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: Record<string, unknown>) => {
      const cat = row.daily_checklist_categories as
        | ChecklistCategory
        | null
        | unknown[];
      return {
        ...(row as DailyChecklistItem),
        daily_checklist_categories:
          Array.isArray(cat) && cat.length > 0
            ? (cat[0] as ChecklistCategory)
            : cat && !Array.isArray(cat)
              ? (cat as ChecklistCategory)
              : null,
      };
    }) as DailyChecklistItem[];

    setItems(normalized);
    if (withLoading) setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
    void loadItems(date);
  }, [date]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`daily-checklist-items-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_checklist_items",
          filter: `checklist_date=eq.${date}`,
        },
        () => {
          if (refreshTimerRef.current) {
            window.clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = window.setTimeout(() => {
            void loadItems(date, false);
          }, 300);
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadItems(date, false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [date]);

  const editItemLabel = (itemId: string, newLabel: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === itemId ? { ...row, label: newLabel } : row,
      ),
    );

    supabase
      .from("daily_checklist_items")
      .update({ label: newLabel })
      .eq("id", itemId)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
        }
      });
  };

  const addItem = async (
    label: string,
    categoryId: string | null,
    targetDate: string,
  ) => {
    const catItems = items.filter((i) => i.category_id === categoryId);
    const minSort = catItems.reduce((min, i) => Math.min(min, i.sort_order), 0);
    const newSort = minSort - 1;
    const tempId = crypto.randomUUID();
    const cat = categories.find((c) => c.id === categoryId) ?? null;

    const optimistic: DailyChecklistItem = {
      id: tempId,
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: newSort,
      created_at: new Date().toISOString(),
      category_id: categoryId,
      daily_checklist_categories: cat,
    };

    setItems((prev) => [optimistic, ...prev]);

    const insertPayload: Record<string, unknown> = {
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: newSort,
    };
    if (categoryId) insertPayload.category_id = categoryId;

    const { data, error } = await supabase
      .from("daily_checklist_items")
      .insert(insertPayload)
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id",
      )
      .single();

    if (error) {
      toast.error(error.message);
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === tempId
          ? { ...i, id: data.id, created_at: data.created_at }
          : i,
      ),
    );
  };

  const toggleItem = (item: DailyChecklistItem) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, is_checked: !row.is_checked } : row,
      ),
    );

    supabase
      .from("daily_checklist_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? { ...row, is_checked: item.is_checked }
                : row,
            ),
          );
        }
      });
  };

  const restoreItem = async (item: DailyChecklistItem) => {
    setItems((prev) =>
      prev.some((i) => i.id === item.id) ? prev : [...prev, item],
    );
    const { error } = await supabase.from("daily_checklist_items").insert({
      id: item.id,
      checklist_date: item.checklist_date,
      label: item.label,
      is_checked: item.is_checked,
      sort_order: item.sort_order,
      created_at: item.created_at,
      ...(item.category_id ? { category_id: item.category_id } : {}),
    });
    if (error) {
      toast.error(error.message);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  const deleteItem = (id: string) => {
    const removed = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));

    supabase
      .from("daily_checklist_items")
      .delete()
      .eq("id", id)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          if (removed) setItems((prev) => [...prev, removed]);
        } else if (removed) {
          toast("Item deleted", {
            duration: 8000,
            action: { label: "Undo", onClick: () => void restoreItem(removed) },
          });
        }
      });
  };

  const checkItems = (ids: string[]) => {
    setItems((prev) =>
      prev.map((row) =>
        ids.includes(row.id) ? { ...row, is_checked: true } : row,
      ),
    );
    supabase
      .from("daily_checklist_items")
      .update({ is_checked: true })
      .in("id", ids)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          setItems((prev) =>
            prev.map((row) =>
              ids.includes(row.id) ? { ...row, is_checked: false } : row,
            ),
          );
        }
      });
  };

  const undoPopulate = async (rows: { id: string; label: string }[]) => {
    const current = itemsRef.current;
    const untouched = rows.filter((r) => {
      const item = current.find((i) => i.id === r.id);
      return item && item.label === r.label && !item.is_checked;
    });
    const kept =
      rows.filter((r) => current.some((i) => i.id === r.id)).length -
      untouched.length;
    setLastPopulate(null);
    if (untouched.length === 0) {
      toast.info("Nothing to undo — items were already changed or removed");
      return;
    }
    const ids = untouched.map((r) => r.id);
    const { error } = await supabase
      .from("daily_checklist_items")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    toast.success(
      `Removed ${ids.length} item${ids.length === 1 ? "" : "s"}${
        kept > 0 ? ` (${kept} kept — edited or ticked)` : ""
      }`,
    );
  };

  const populateDue = async (categoryId: string | null, targetDate: string) => {
    let groups: DueChecklistGroup[];
    try {
      const res = await fetch(`/api/checklist/due?date=${targetDate}`);
      if (!res.ok) throw new Error("Failed to load due collections");
      groups = ((await res.json()) as { groups: DueChecklistGroup[] }).groups;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to populate");
      return;
    }

    const already = new Set(
      itemsRef.current.flatMap((i) =>
        extractScheduleRefs(i.label).map((r) => r.id),
      ),
    );
    const labels = groups
      .map((g) => ({ ...g, items: g.items.filter((i) => !already.has(i.id)) }))
      .filter((g) => g.items.length > 0)
      .map(buildDueLabel);
    if (labels.length === 0) {
      toast.info(
        "Nothing new to add — everything due on this date is already listed",
      );
      return;
    }

    const minSort = itemsRef.current
      .filter((i) => i.category_id === categoryId)
      .reduce((min, i) => Math.min(min, i.sort_order), 0);
    const payload = labels.map((label, idx) => ({
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: minSort - labels.length + idx,
      ...(categoryId ? { category_id: categoryId } : {}),
    }));
    const { data, error } = await supabase
      .from("daily_checklist_items")
      .insert(payload)
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id",
      );
    if (error) {
      toast.error(error.message);
      return;
    }

    const cat = categories.find((c) => c.id === categoryId) ?? null;
    const created = ((data ?? []) as DailyChecklistItem[]).map((row) => ({
      ...row,
      daily_checklist_categories: cat,
    }));
    const rows = created.map((c) => ({ id: c.id, label: c.label }));
    setItems((prev) => [
      ...created,
      ...prev.filter((p) => !created.some((c) => c.id === p.id)),
    ]);
    setLastPopulate({ date: targetDate, categoryId, rows });
    toast.success(
      `Added ${created.length} borrower${created.length === 1 ? "" : "s"}`,
      {
        duration: 8000,
        action: { label: "Undo", onClick: () => void undoPopulate(rows) },
      },
    );
  };

  const dayTotals = useMemo(() => summarizeChecklist(items), [items]);

  const grouped = useMemo(() => {
    const map = new Map<string | null, DailyChecklistItem[]>();
    for (const item of items) {
      const key = item.category_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div
        className="sticky top-4 z-10 flex items-center justify-between gap-3
          rounded-2xl border border-border/50 bg-background/80 p-3
          backdrop-blur-md"
      >
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="dark:bg-card/50 dark:text-foreground min-w-0 flex-1
            rounded-xl border border-border/50 bg-white/60 px-3 py-2 text-sm
            font-medium text-slate-700 transition-all duration-200
            focus:border-border focus:outline-none"
        />
        <Link
          href="/daily-checklist/categories"
          className="dark:text-muted-foreground dark:hover:bg-muted/60
            inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2
            text-xs font-semibold text-slate-600 transition-all duration-200
            hover:bg-slate-100"
          aria-label="Manage categories"
        >
          <Settings className="size-4" />
          <span className="hidden sm:inline">Categories</span>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/50 p-4 sm:p-5"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-5 w-20 animate-pulse rounded-full bg-slate-200
                    dark:bg-muted/60"
                />
                <div
                  className="h-4 w-10 animate-pulse rounded-full bg-slate-100
                    dark:bg-muted/40"
                />
                <div
                  className="ml-auto h-4 w-4 animate-pulse rounded-full
                    bg-slate-100 dark:bg-muted/40"
                />
              </div>
              <div className="mt-4 space-y-2">
                <div
                  className="h-8 animate-pulse rounded-xl bg-slate-100
                    dark:bg-muted/30"
                />
                <div
                  className="h-8 animate-pulse rounded-xl bg-slate-100
                    dark:bg-muted/30"
                />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 && categories.length === 0 ? (
        <div
          className="dark:text-muted-foreground flex flex-col items-center gap-3
            rounded-2xl border border-border/50 py-16 text-center"
        >
          <div
            className="flex size-12 items-center justify-center rounded-full
              bg-slate-100 dark:bg-muted/40"
          >
            <Plus className="size-6 text-slate-400" />
          </div>
          <div>
            <p
              className="text-sm font-semibold text-slate-600
                dark:text-foreground"
            >
              No categories yet
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Create a category to start organizing your tasks
            </p>
          </div>
          <Link
            href="/daily-checklist/categories"
            className="mt-1 rounded-lg bg-slate-900 px-4 py-2 text-xs
              font-semibold text-white transition-colors duration-200
              hover:bg-slate-700 dark:bg-foreground dark:text-background
              dark:hover:bg-foreground/80"
          >
            Create category
          </Link>
        </div>
      ) : (
        <>
          {dayTotals.collections > 0 && (
            <div
              className="dark:bg-background/80 grid grid-cols-3 gap-2
                rounded-2xl border border-border/50 bg-white p-3 text-center
                shadow-sm"
            >
              {[
                ["Expected", dayTotals.expected],
                ["Checked off", dayTotals.checkedOff],
                ["Left", dayTotals.left],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p
                    className="dark:text-muted-foreground text-[10px]
                      font-semibold tracking-wide text-slate-400 uppercase"
                  >
                    {label}
                  </p>
                  <p
                    className="text-sm font-bold text-slate-700 tabular-nums
                      dark:text-foreground"
                  >
                    ₱{(value as number).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          {categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              items={grouped.get(cat.id) ?? []}
              date={date}
              onAdd={addItem}
              onToggle={toggleItem}
              onDelete={deleteItem}
              onEditLabel={editItemLabel}
              onPopulate={populateDue}
              onCheckMany={checkItems}
              onUndoPopulate={
                lastPopulate &&
                lastPopulate.date === date &&
                lastPopulate.categoryId === cat.id
                  ? () => void undoPopulate(lastPopulate.rows)
                  : undefined
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
