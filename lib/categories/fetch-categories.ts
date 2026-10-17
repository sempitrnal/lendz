import type { CategoryRow } from "@/lib/cache/categories";

/** All categories, from `/api/categories` (saved for offline by the worker). */
export async function fetchCategories(): Promise<CategoryRow[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error(`categories ${res.status}`);
  return (await res.json()) as CategoryRow[];
}
