import { supabase } from "@/lib/supabase/client";
import { getPendingOutboxCount } from "@/lib/offline/outbox";
import { todayDateValue } from "@/lib/checklist/dates";
import type {
  ChecklistCategory,
  DailyChecklistItem,
} from "@/lib/checklist/types";

/**
 * Local snapshot of the daily checklist so the page (items, progress, amount
 * left and collected) still renders offline. Writes made offline are queued
 * by the service worker outbox; the snapshot carries them until it replays.
 */
const CATEGORIES_KEY = "lendz-checklist-categories";
const ITEMS_PREFIX = "lendz-checklist-items:";
/** Day snapshots older than this (by checklist date) are pruned. */
const KEEP_DAYS = 45;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — the checklist still works online
  }
}

export function readCachedCategories(): ChecklistCategory[] | null {
  return read<ChecklistCategory[]>(CATEGORIES_KEY);
}

export function writeCachedCategories(categories: ChecklistCategory[]) {
  write(CATEGORIES_KEY, categories);
}

export function readCachedItems(date: string): DailyChecklistItem[] | null {
  return read<DailyChecklistItem[]>(ITEMS_PREFIX + date);
}

export function writeCachedItems(date: string, items: DailyChecklistItem[]) {
  write(ITEMS_PREFIX + date, items);
  pruneOldDays();
}

function pruneOldDays() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
    const cutoffValue = cutoff.toISOString().slice(0, 10);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(ITEMS_PREFIX)) {
        if (key.slice(ITEMS_PREFIX.length) < cutoffValue) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * True when a failed Supabase write was captured by the service worker's
 * offline outbox (it answers 503 `{ offline_queued: true }`) and will be
 * replayed once back online — callers keep their optimistic update.
 */
export function wasQueuedOffline(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { offline_queued?: unknown }).offline_queued === true
  );
}

export async function fetchChecklistCategories(): Promise<{
  categories: ChecklistCategory[];
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from("daily_checklist_categories")
    .select("id, name, color, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return { categories: (data ?? []) as ChecklistCategory[], error };
}

export async function fetchChecklistItems(date: string): Promise<{
  items: DailyChecklistItem[];
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from("daily_checklist_items")
    .select(
      "id, checklist_date, label, is_checked, sort_order, created_at, category_id, daily_checklist_categories(id, name, color, sort_order)",
    )
    .eq("checklist_date", date)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const items = (data ?? []).map((row: Record<string, unknown>) => {
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
  return { items, error };
}

/**
 * Snapshots categories and today's items so the checklist opens offline even
 * if it wasn't visited this session. Skipped while offline edits are queued,
 * since the server copy would be missing them.
 */
export async function warmChecklistCache() {
  if ((await getPendingOutboxCount()) > 0) return;
  const date = todayDateValue();
  const [cats, day] = await Promise.all([
    fetchChecklistCategories(),
    fetchChecklistItems(date),
  ]);
  if (!cats.error) writeCachedCategories(cats.categories);
  if (!day.error) writeCachedItems(date, day.items);
}
