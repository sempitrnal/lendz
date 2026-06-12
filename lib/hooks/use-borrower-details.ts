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
  notes: Record<string, unknown>[];
};

export function borrowerDetailsQueryKey(borrowerId: string) {
  return ["borrower", borrowerId, "details"] as const;
}

export function useBorrowerDetails(
  borrowerId: string,
  initialData?: BorrowerDetailsResponse,
) {
  return useQuery({
    queryKey: borrowerDetailsQueryKey(borrowerId),
    queryFn: async (): Promise<BorrowerDetailsResponse> => {
      const res = await fetch(`/api/borrowers/${borrowerId}/details`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to fetch borrower details");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData,
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
