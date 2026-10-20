"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export type BorrowerDetailsResponse = {
  borrower: {
    id: string;
    first_name: string;
    last_name: string;
    contact: string | null;
    created_at: string;
  };
  accounts: Record<string, unknown>[];
  metrics: Record<string, unknown>;
  notes?: Record<string, unknown>[];
};

export function borrowerDetailsQueryKey(borrowerId: string) {
  return ["borrower", borrowerId, "details"] as const;
}

export async function fetchBorrowerDetails(
  borrowerId: string,
): Promise<BorrowerDetailsResponse> {
  const res = await fetch(`/api/borrowers/${borrowerId}/details`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch borrower details");
  }
  return res.json();
}

/**
 * `seed` is what the server already rendered. With its notes included it counts
 * as the query's first result, so opening the page doesn't fetch it all again;
 * without notes it only stands in while the fetch runs.
 */
export function useBorrowerDetails(
  borrowerId: string,
  seed?: BorrowerDetailsResponse,
) {
  const seeded = seed?.notes !== undefined;
  return useQuery({
    queryKey: borrowerDetailsQueryKey(borrowerId),
    queryFn: () => fetchBorrowerDetails(borrowerId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData: seeded ? seed : undefined,
    initialDataUpdatedAt: seeded ? () => Date.now() : undefined,
    placeholderData: seeded ? undefined : seed,
  });
}

export function useInvalidateBorrowerDetails() {
  const queryClient = useQueryClient();
  return (borrowerId: string) => {
    queryClient.invalidateQueries({
      queryKey: borrowerDetailsQueryKey(borrowerId),
    });
  };
}
