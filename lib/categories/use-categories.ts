"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryRow } from "@/lib/cache/categories";
import { fetchCategories } from "@/lib/categories/fetch-categories";

export const CATEGORIES_KEY = ["categories"] as const;

const options = {
  queryKey: CATEGORIES_KEY,
  queryFn: fetchCategories,
  staleTime: 60 * 1000,
};

/** Every category, shared by the pages and sheets that pick or filter by one. */
export function useCategories() {
  return useQuery<CategoryRow[]>(options);
}

/**
 * Starts loading the categories ahead of a sheet that shows them, so it opens
 * with its chips in place instead of growing while it slides up.
 */
export function usePrefetchCategories() {
  const queryClient = useQueryClient();
  return () => void queryClient.prefetchQuery(options);
}
