"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { Settings, Check, Trash2, ChevronDown, Pencil } from "lucide-react";
import { useTheme } from "next-themes";
import Modal from "@/components/modal";

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
/** Lighten a hex color to ~20% opacity equivalent on white */
function tintColor(hex: string, opacity = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c * opacity + 255 * (1 - opacity));
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

/** Darken a hex color by mixing with dark card background (#161b22) */
function darkTintColor(hex: string, opacity = 0.25): string {
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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

  const bgColor = category
    ? isDark
      ? darkTintColor(category.color, 0.25)
      : tintColor(category.color, 0.15)
    : undefined;
  const borderColor = category ? category.color : undefined;

  return (
    <div
      className="dark:border-border rounded-xl border-2 border-slate-900 p-3 shadow-[3px_3px_0px_0px_#0f172a] sm:p-4 dark:shadow-none"
      style={{
        backgroundColor: bgColor ?? (isDark ? "#161b22" : "#f8fafc"),
        borderColor: borderColor ?? undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-2 ${expanded ? "mb-2" : ""}`}
      >
        {category && (
          <span
            className="dark:border-border/50 inline-block size-3 shrink-0 rounded-sm border border-slate-900/25"
            style={{ backgroundColor: category.color }}
            aria-hidden
          />
        )}
        <h3 className="dark:text-foreground text-sm font-black text-slate-900 lowercase">
          {category ? category.name : "uncategorized"}
        </h3>
        <span className="dark:text-muted-foreground text-xs font-semibold text-slate-500">
          {checkedCount}/{items.length}
        </span>
        <ChevronDown
          className={`dark:text-muted-foreground ml-auto size-4 text-slate-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <>
          <div className="mb-5 flex flex-col gap-2">
            <textarea
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`Add item${category ? ` to ${category.name}` : ""}...`}
              className="dark:border-border dark:bg-card dark:text-foreground w-full rounded-md border-2 border-slate-900 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving}
              className="dark:border-border shrink-0 rounded-md border-2 border-slate-900 bg-emerald-200 px-3 py-1.5 text-xs font-bold text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:shadow-none dark:hover:bg-emerald-900/40"
            >
              {saving ? "..." : "add"}
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="dark:border-border/50 dark:bg-card/60 dark:text-muted-foreground rounded-md border-2 border-dashed border-slate-400 bg-white/60 px-3 py-2 text-xs text-slate-500">
              No items yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  onClick={() => onToggle(item)}
                  className={`dark:border-border flex cursor-pointer items-center gap-2 rounded-lg border-2 border-slate-900 px-3 py-1.5 transition ${
                    item.is_checked
                      ? "bg-green-200 opacity-80 dark:bg-[#0f2417]"
                      : "dark:bg-card dark:hover:bg-muted bg-white hover:bg-slate-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(item);
                    }}
                    title={item.is_checked ? "Uncheck" : "Check"}
                    className={`dark:border-border shrink-0 rounded-md border-2 border-slate-900 p-1 transition ${
                      item.is_checked
                        ? "bg-emerald-400 text-white dark:bg-[#2ea043]"
                        : "dark:bg-card dark:text-muted-foreground bg-white text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                    }`}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <span
                    className={`min-w-0 flex-1 -translate-y-[0.8px] overflow-hidden text-lg font-bold break-words whitespace-pre-wrap ${item.is_checked ? "dark:text-muted-foreground text-slate-500 line-through" : "dark:text-foreground text-slate-900"}`}
                  >
                    {item.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(item);
                        setEditLabelValue(item.label);
                      }}
                      title="Edit"
                      className="dark:border-border dark:bg-card dark:text-muted-foreground rounded-md border-2 border-slate-900 bg-white p-1 text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-900/20 dark:hover:text-violet-400"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      title="Delete"
                      className="dark:border-border dark:bg-card rounded-md border-2 border-slate-900 bg-white p-1 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Edit-label modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        closeOnEscape
        closeOnOverlayClick
        title="Edit item"
        size="md"
      >
        {editingItem && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold tracking-wide text-slate-900 lowercase dark:text-zinc-100">
                label
              </label>
              <textarea
                value={editLabelValue}
                onChange={(e) => setEditLabelValue(e.target.value)}
                rows={4}
                className="dark:border-border dark:bg-card dark:text-foreground w-full resize-none rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm text-slate-900 transition outline-none focus:translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#334155] dark:focus:shadow-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="dark:border-border dark:bg-card dark:text-foreground rounded-md border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] transition hover:translate-x-0.5 hover:-translate-y-0.5 dark:shadow-none"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = editLabelValue.trim();
                  if (trimmed) {
                    onEditLabel(editingItem.id, trimmed);
                  }
                  setEditingItem(null);
                }}
                className="dark:border-border rounded-md border-2 border-slate-900 bg-emerald-200 px-3 py-1.5 text-xs font-bold text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] transition hover:translate-x-0.5 hover:-translate-y-0.5 dark:bg-emerald-900/40 dark:text-emerald-300 dark:shadow-none"
              >
                save
              </button>
            </div>
          </div>
        )}
      </Modal>
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
    <div className="flex flex-col gap-5">
      <article className="dark:border-border dark:via-card rounded-xl border-2 border-slate-900 bg-linear-to-br from-violet-50 via-white to-fuchsia-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5 dark:from-violet-950/20 dark:to-fuchsia-950/20 dark:shadow-none">
        <div className="flex items-center justify-between">
          <h2 className="dark:text-foreground text-base font-black text-slate-900 lowercase"></h2>
          <div className="flex items-center gap-2">
            <Link
              href="/daily-checklist/categories"
              className="dark:border-border dark:bg-card dark:text-foreground inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-white px-2 py-1 text-xs font-bold text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] transition hover:translate-x-0.5 hover:-translate-y-0.5 dark:shadow-none"
            >
              <Settings className="size-3" />
              categories
            </Link>
          </div>
        </div>
        <div className="mt-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="dark:border-border dark:bg-card dark:text-foreground w-full min-w-0 rounded-md border-2 border-slate-900 px-2 py-1.5 text-sm font-semibold text-slate-900"
          />
        </div>
      </article>

      {loading ? (
        <div className="dark:border-border/50 dark:bg-muted dark:text-muted-foreground rounded-xl border-2 border-dashed border-slate-400 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          Loading checklist...
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

          {/* <CategorySection
            category={null}
            items={grouped.get(null) ?? []}
            date={date}
            onAdd={addItem}
            onToggle={toggleItem}
            onDelete={deleteItem}
            onEditLabel={editItemLabel}
          /> */}
        </>
      )}
    </div>
  );
}
