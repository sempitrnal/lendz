"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";

export const BORROWERS_SEARCH_KEY = ["borrowers-search"] as const;

async function fetchBorrowersForSearch(): Promise<BorrowerSearchItem[]> {
  const res = await fetch("/api/borrowers");
  if (!res.ok) throw new Error("Failed to fetch borrowers");
  return res.json();
}

export function useBorrowersSearch() {
  return useQuery<BorrowerSearchItem[]>({
    queryKey: BORROWERS_SEARCH_KEY,
    queryFn: fetchBorrowersForSearch,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSeedBorrowersSearch() {
  const queryClient = useQueryClient();
  return (borrowers: BorrowerSearchItem[]) => {
    if (!queryClient.getQueryData(BORROWERS_SEARCH_KEY)) {
      queryClient.setQueryData(BORROWERS_SEARCH_KEY, borrowers);
    }
  };
}
