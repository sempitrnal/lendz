"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

type DailyChecklistItem = {
  id: string;
  checklist_date: string;
  label: string;
  is_checked: boolean;
  sort_order: number;
  created_at: string;
};

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyNotesWidget() {
  const [items, setItems] = useState<DailyChecklistItem[]>([]);
  const [date, setDate] = useState(todayDateValue());
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.created_at.localeCompare(a.created_at);
      }),
    [items]
  );

  const loadItems = async (targetDate: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_checklist_items")
      .select("id, checklist_date, label, is_checked, sort_order, created_at")
      .eq("checklist_date", targetDate)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as DailyChecklistItem[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadItems(date);
  }, [date]);

  const addItem = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;

    setSaving(true);
    const maxSort = items.reduce((max, item) => Math.max(max, item.sort_order), -1);
    const { error } = await supabase.from("daily_checklist_items").insert({
      checklist_date: date,
      label: trimmed,
      is_checked: false,
      sort_order: maxSort + 1,
    });

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setNewLabel("");
    await loadItems(date);
  };

  const toggleItem = async (item: DailyChecklistItem) => {
    const { error } = await supabase
      .from("daily_checklist_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, is_checked: !row.is_checked } : row
      )
    );
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("daily_checklist_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-violet-50 via-white to-fuchsia-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
      <h2 className="mb-3 text-base font-black lowercase text-slate-900">
        daily checklist
      </h2>
      <div className="space-y-2 rounded-lg border-2 border-slate-900 bg-white p-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full min-w-0 rounded-md border-2 border-slate-900 px-2 py-1.5 text-sm font-semibold text-slate-900"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add checklist item..."
            className="w-full rounded-md border-2 border-slate-900 px-2 py-1.5 text-sm text-slate-900"
          />
          <button
            type="button"
            onClick={() => {
              void addItem();
            }}
            disabled={saving}
            className="rounded-md border-2 border-slate-900 bg-emerald-200 px-3 py-1.5 text-xs font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300"
          >
            {saving ? "..." : "add"}
          </button>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {loading ? (
          <li className="rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Loading checklist...
          </li>
        ) : sortedItems.length === 0 ? (
          <li className="rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No checklist items for this date.
          </li>
        ) : (
          sortedItems.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border-2 border-slate-900 bg-slate-50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={() => {
                      void toggleItem(item);
                    }}
                    className="size-4 rounded border-2 border-slate-900 accent-emerald-500"
                  />
                  <span
                    className={`text-sm ${item.is_checked ? "text-slate-500 line-through" : "text-slate-900"}`}
                  >
                    {item.label}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    void deleteItem(item.id);
                  }}
                  className="text-xs font-bold uppercase text-rose-700"
                >
                  delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </article>
  );
}
