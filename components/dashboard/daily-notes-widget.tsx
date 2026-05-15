"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { Settings, Check, ArrowRightLeft, Trash2, ChevronDown } from "lucide-react";
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

function CategorySection({
  category,
  items,
  date,
  onAdd,
  onToggle,
  onDelete,
  onChangeCategory,
  categories,
}: {
  category: ChecklistCategory | null;
  items: DailyChecklistItem[];
  date: string;
  onAdd: (label: string, categoryId: string | null, date: string) => Promise<void>;
  onToggle: (item: DailyChecklistItem) => void;
  onDelete: (id: string) => void;
  onChangeCategory: (itemId: string, newCategoryId: string | null) => void;
  categories: ChecklistCategory[];
}) {
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyChecklistItem | null>(null);
  const [expanded, setExpanded] = useState(false);

  const checkedCount = items.filter((i) => i.is_checked).length;

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.created_at.localeCompare(a.created_at);
      }),
    [items]
  );

  const handleAdd = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAdd(trimmed, category?.id ?? null, date);
    setSaving(false);
    setNewLabel("");
  };

  const bgColor = category ? tintColor(category.color, 0.15) : undefined;
  const borderColor = category ? category.color : undefined;

  return (
    <div
      className="rounded-xl border-2 border-slate-900 p-3 shadow-[3px_3px_0px_0px_#0f172a] sm:p-4"
      style={{
        backgroundColor: bgColor ?? "#f8fafc",
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
            className="inline-block size-3 shrink-0 rounded-sm border border-slate-900/25"
            style={{ backgroundColor: category.color }}
            aria-hidden
          />
        )}
        <h3 className="text-sm font-black lowercase text-slate-900">
          {category ? category.name : "uncategorized"}
        </h3>
        <span className="text-xs font-semibold text-slate-500">
          {checkedCount}/{items.length}
        </span>
        <ChevronDown
          className={`ml-auto size-4 text-slate-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <>
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
              placeholder={`Add item${category ? ` to ${category.name}` : ""}...`}
              className="w-full rounded-md border-2 border-slate-900 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving}
              className="shrink-0 rounded-md border-2 border-slate-900 bg-emerald-200 px-3 py-1.5 text-xs font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300"
            >
              {saving ? "..." : "add"}
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="rounded-md border-2 border-dashed border-slate-400 bg-white/60 px-3 py-2 text-xs text-slate-500">
              No items yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sorted.map((item) => (
                <li
                onClick={() => onToggle(item)}
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg transition border-2 border-slate-900  px-3 py-1.5  ${item.is_checked ? "bg-green-200 opacity-80" : " bg-white hover:bg-slate-100"}`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(item)}
                    title={item.is_checked ? "Uncheck" : "Check"}
                    className={`shrink-0 rounded-md border-2 border-slate-900 p-1 transition ${
                      item.is_checked
                        ? "bg-emerald-400 text-white"
                        : "bg-white text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                    }`}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <span
                    className={`min-w-0 flex-1 text-lg -translate-y-[0.8px] font-bold ${item.is_checked ? "text-slate-500 line-through" : "text-slate-900"}`}
                  >
                    {item.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      title="Move to category"
                      className="rounded-md border-2 border-slate-900 bg-white p-1 text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      title="Delete"
                      className="rounded-md border-2 border-slate-900 bg-white p-1 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
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

      {/* Move-to-category modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        closeOnEscape
        closeOnOverlayClick
        title="Move to category"
        size="sm"
      >
        {editingItem && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Moving <strong className="text-slate-900">{editingItem.label}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onChangeCategory(editingItem.id, null);
                  setEditingItem(null);
                }}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-bold lowercase transition ${
                  editingItem.category_id === null
                    ? "border-slate-900 bg-slate-900 text-white shadow-[3px_3px_0px_0px_#0f172a]"
                    : "border-slate-900 bg-slate-100 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a] hover:-translate-y-0.5 hover:translate-x-0.5"
                }`}
              >
                uncategorized
              </button>
              {categories.map((c) => {
                const isActive = editingItem.category_id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChangeCategory(editingItem.id, c.id);
                      setEditingItem(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg border-2 border-slate-900 px-3 py-2 text-sm font-bold lowercase shadow-[3px_3px_0px_0px_#0f172a] transition ${
                      isActive
                        ? ""
                        : "hover:-translate-y-0.5 hover:translate-x-0.5"
                    }`}
                    style={{
                      backgroundColor: isActive
                        ? c.color
                        : tintColor(c.color, 0.2),
                      color: "#0f172a",
                    }}
                  >
                    <span
                      className="inline-block size-3 rounded-sm border border-slate-900/25"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    {c.name}
                  </button>
                );
              })}
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
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id, daily_checklist_categories(id, name, color, sort_order)"
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

  const addItem = async (
    label: string,
    categoryId: string | null,
    targetDate: string
  ) => {
    const maxSort = items.reduce(
      (max, item) => Math.max(max, item.sort_order),
      -1
    );
    const newSort = maxSort + 1;
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

    setItems((prev) => [...prev, optimistic]);

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
      .select("id, checklist_date, label, is_checked, sort_order, created_at, category_id")
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
          : i
      )
    );
  };

  const toggleItem = (item: DailyChecklistItem) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, is_checked: !row.is_checked } : row
      )
    );

    supabase
      .from("daily_checklist_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id)
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? { ...row, is_checked: item.is_checked }
                : row
            )
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
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          if (removed) setItems((prev) => [...prev, removed]);
        }
      });
  };

  const changeItemCategory = (
    itemId: string,
    newCategoryId: string | null
  ) => {
    const prev = items.find((i) => i.id === itemId);
    const oldCategoryId = prev?.category_id ?? null;
    const newCat = categories.find((c) => c.id === newCategoryId) ?? null;

    setItems((prev) =>
      prev.map((row) =>
        row.id === itemId
          ? { ...row, category_id: newCategoryId, daily_checklist_categories: newCat }
          : row
      )
    );

    supabase
      .from("daily_checklist_items")
      .update({ category_id: newCategoryId })
      .eq("id", itemId)
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          const oldCat =
            categories.find((c) => c.id === oldCategoryId) ?? null;
          setItems((prev) =>
            prev.map((row) =>
              row.id === itemId
                ? {
                    ...row,
                    category_id: oldCategoryId,
                    daily_checklist_categories: oldCat,
                  }
                : row
            )
          );
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
      <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-violet-50 via-white to-fuchsia-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black lowercase text-slate-900">
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href="/daily-checklist/categories"
              className="inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-white px-2 py-1 text-xs font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5"
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
            className="w-full min-w-0 rounded-md border-2 border-slate-900 px-2 py-1.5 text-sm font-semibold text-slate-900"
          />
        </div>
      </article>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-slate-400 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
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
              onChangeCategory={changeItemCategory}
              categories={categories}
            />
          ))}

          {/* <CategorySection
            category={null}
            items={grouped.get(null) ?? []}
            date={date}
            onAdd={addItem}
            onToggle={toggleItem}
            onDelete={deleteItem}
            onChangeCategory={changeItemCategory}
            categories={categories}
          /> */}
        </>
      )}
    </div>
  );
}
