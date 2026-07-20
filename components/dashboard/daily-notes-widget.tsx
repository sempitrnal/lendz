"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ChecklistCategory = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

type DailyChecklistItem = {
  id: string;
  checklist_date: string;
  label: string;
  is_checked: boolean;
  sort_order: number;
  created_at: string;
  category_id: string | null;
  daily_checklist_categories: ChecklistCategory | null;
};

function todayDateValue() {
  return new Date().toLocaleDateString("en-CA");
}

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

/** Derive a readable text color from a hex color (lighten/darken for contrast) */
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
}) {
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyChecklistItem | null>(
    null,
  );
  const [editLabelValue, setEditLabelValue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const newLabelRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream,
    );
  }, []);

  useEffect(() => {
    const el = newLabelRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [newLabel]);

  const checkedCount = items.filter((i) => i.is_checked).length;

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.created_at.localeCompare(a.created_at);
      }),
    [items],
  );

  const handleAdd = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAdd(trimmed, category?.id ?? null, date);
    setSaving(false);
    setNewLabel("");
  };

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
      className="rounded-2xl border border-border/50 p-2 transition-all
        duration-200 sm:p-5"
      style={{
        backgroundColor: bgColor ?? undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-2.5 ${expanded ? "mb-3" : ""}`}
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
            className="dark:text-muted-foreground shrink-0 text-xs font-semibold
              text-slate-400"
          >
            Uncategorized
          </span>
        )}
        <span
          className="dark:text-muted-foreground text-xs font-medium
            text-slate-400 tabular-nums"
        >
          {checkedCount}/{items.length}
        </span>
        <ChevronDown
          className={`dark:text-muted-foreground ml-auto size-4 text-slate-400
            transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <>
          <div className="mb-4 flex flex-col gap-2">
            <textarea
              ref={newLabelRef}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (isIOS) {
                  // On iOS, let Return insert newlines and use the add button
                  // to submit.
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder={`Add item${category ? ` to ${category.name}` : ""}…`}
              rows={1}
              className="dark:bg-card/50 dark:text-foreground w-full resize-none
                rounded-xl border border-border/50 bg-white/60 px-3 py-2 text-sm
                text-slate-700 transition-all duration-200
                placeholder:text-slate-400 focus:border-border
                focus:outline-none dark:placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving || !newLabel.trim()}
              className="dark:text-foreground dark:hover:bg-muted/60 shrink-0
                self-start rounded-lg px-3 py-1.5 text-xs font-semibold
                text-slate-600 bg-white dark:bg-slate-800 transition-all
                duration-200 hover:bg-slate-100 disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add item"}
            </button>
          </div>

          {sorted.length === 0 ? (
            <div
              className="dark:text-muted-foreground flex flex-col items-center
                gap-2 py-8 text-center"
            >
              <p className="text-sm text-slate-400">
                No items in this category yet.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  onClick={() => onToggle(item)}
                  className={`group flex cursor-pointer items-center gap-3
                    rounded-xl border px-2 py-2 transition-all duration-200 ${
                      item.is_checked
                        ? `bg-slate-50 dark:border-muted-foreground/30
                          dark:bg-muted/80`
                        : `bg-white shadow-sm hover:bg-slate-100
                          dark:border-muted-foreground/20 dark:bg-muted
                          dark:hover:bg-muted/40`
                    }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(item);
                    }}
                    title={item.is_checked ? "Uncheck" : "Check"}
                    className={`shrink-0 rounded-full border-2 p-0
                      transition-all duration-200 ${
                        item.is_checked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : `border-slate-300 text-transparent
                            hover:border-emerald-400
                            dark:border-muted-foreground/40`
                      }`}
                    aria-label={item.is_checked ? "Uncheck" : "Check"}
                  >
                    <Check className="size-2" strokeWidth={2} />
                  </button>
                  <span
                    className={`min-w-0 flex-1 overflow-hidden text-sm
                      font-medium break-words whitespace-pre-wrap transition-all
                      duration-200 ${
                        item.is_checked
                          ? `text-slate-400 line-through
                            dark:text-muted-foreground/60`
                          : "text-slate-700 dark:text-foreground"
                      }`}
                  >
                    {item.label}
                  </span>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenFor(
                          menuOpenFor === item.id ? null : item.id,
                        );
                      }}
                      className="rounded-lg p-1.5 text-slate-400
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
        <DialogContent className="sm:max-w-md">
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
                <textarea
                  value={editLabelValue}
                  onChange={(e) => setEditLabelValue(e.target.value)}
                  rows={4}
                  className="dark:bg-card dark:text-foreground w-full
                    resize-none rounded-xl border border-border/50 bg-white px-3
                    py-2.5 text-sm text-slate-700 transition-all duration-200
                    outline-none focus:border-border
                    dark:placeholder:text-muted-foreground"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const trimmed = editLabelValue.trim();
                    if (trimmed) {
                      onEditLabel(editingItem.id, trimmed);
                    }
                    setEditingItem(null);
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DailyNotesWidget() {
  const [items, setItems] = useState<DailyChecklistItem[]>([]);
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

  const loadItems = async (targetDate: string) => {
    setLoading(true);
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
      setLoading(false);
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
    setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
    void loadItems(date);
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
        }
      });
  };

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
            />
          ))}
        </>
      )}
    </div>
  );
}
