"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { fetchCategoriesAction } from "@/lib/actions/categories";
import { formFieldInputClassName } from "@/lib/form-field-classes";
import {
  mapAccountIdToNextDueSchedule,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import AddBorrowerModal from "./add-borrower-modal";
import { BorrowerCard } from "./borrower-card";
import { BsChevronDown, BsChevronLeft, BsChevronRight } from "react-icons/bs";
import { FaPlus } from "react-icons/fa6";
import Link from "next/link";

export type Borrower = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  created_at: string;
  borrower_categories: {
    category: {
      id: string;
      name: string;
      color: string | null;
    };
  }[];
  next_collection_date?: string | null;
  next_collection_amount?: number;
  next_collection_amounts?: number[];
  next_collection_status?: string | null;
  has_accounts?: boolean;
  all_accounts_pending?: boolean;
  pending_principal_total?: number;
  overdue_total?: number;
  overdue_count?: number;
  accounts_count?: number;
  account_schedules?: { account_id?: string; due_date: string; amount: number; status: string; total_schedules?: number; paid_schedules_count?: number; schedule_mode?: string | null; principal_amount?: number | null; amount_paid_total?: number; interest_rate?: number | null; amount_due_per_schedule?: number | null; overdue_schedules?: { due_date: string; amount: number }[] }[];
  overdue_schedules?: { due_date: string; amount: number; status: string }[];
  manual_total_principal?: number;
  manual_total_paid?: number;
  manual_total_remaining?: number;
  manual_accounts_count?: number;
};

type BorrowersListProps = {
  initialBorrowers: Borrower[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  initialSearchQuery?: string;
  initialCategoryIds?: string[];
};

function buildBorrowersUrl(page: number, q: string, categoryIds: string[] = []): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (categoryIds.length > 0) params.set("categories", categoryIds.join(","));
  const qs = params.toString();
  return `/borrowers${qs ? `?${qs}` : ""}`;
}

export default function BorrowersList({
  initialBorrowers,
  currentPage,
  totalPages,
  totalCount,
  initialSearchQuery = "",
  initialCategoryIds = [],
}: BorrowersListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: string; first_name: string; last_name: string; contact: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryIds);

  const navigateSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.push(buildBorrowersUrl(1, q, selectedCategoryIds));
      }, 400);
    },
    [router, selectedCategoryIds]
  );

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length === 0) { setSuggestions([]); setShowSuggestions(false); return; }
    const pattern = `%${q.trim()}%`;
    const { data } = await supabase
      .from("borrowers")
      .select("id, first_name, last_name, contact")
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},contact.ilike.${pattern}`)
      .order("first_name", { ascending: true })
      .limit(6);
    setSuggestions((data ?? []) as { id: string; first_name: string; last_name: string; contact: string | null }[]);
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync local state when server prop changes (e.g. back/forward navigation)
  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);
  useEffect(() => {
    setSelectedCategoryIds(initialCategoryIds);
  }, [initialCategoryIds]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isAddBorrowerModalOpen, setIsAddBorrowerModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const [updatingBorrowerId, setUpdatingBorrowerId] = useState<string | null>(
    null
  );

  function openAddBorrowerModal() {
    setIsAddBorrowerModalOpen(true);
  }
  function closeAddBorrowerModal() {
    setIsAddBorrowerModalOpen(false);
  }

  function refreshPage() {
    router.refresh();
  }


  const navigateCategories = useCallback(
    (newCategoryIds: string[]) => {
      router.push(buildBorrowersUrl(1, searchQuery.trim(), newCategoryIds));
    },
    [router, searchQuery]
  );

  const [categories, setCategories] = useState<
    { id: string; name: string; color: string | null }[]
  >([]);

  useEffect(() => {
    fetchCategoriesAction().then((rows) => {
      setCategories(rows.map((c) => ({ id: c.id, name: c.name, color: c.color })));
    });
  }, []);

  return (
    <div className="">
      <AddBorrowerModal
        getBorrowers={refreshPage}
        openModal={openAddBorrowerModal}
        isOpen={isAddBorrowerModalOpen}
        onClose={closeAddBorrowerModal}
      />

      <div className="mb-6 flex items-center justify-between">
        <div>
          {/* <h1 className="text-2xl font-black lowercase">Borrowers</h1> */}
          {/* <p className="text-xs text-slate-500 mt-1">
            {totalCount} total
          </p> */}
        </div>
      </div>

      {isMounted && createPortal(
        <button
          type="button"
          onClick={openAddBorrowerModal}
          aria-label="Add borrower"
          className="fixed bottom-[76px] right-4 z-[9999] flex size-14 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-900 text-white shadow-[3px_3px_0px_0px_rgb(15_23_42/0.4)] transition-transform duration-200 active:scale-95"
        >
          <FaPlus className="size-5" />
        </button>,
        document.body
      )}

      <div className="mb-6 flex flex-col gap-3">
        <div ref={searchWrapperRef} className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              const v = e.target.value;
              setSearchQuery(v);
              navigateSearch(v.trim());
              if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
              suggestDebounceRef.current = setTimeout(() => fetchSuggestions(v), 200);
            }}
            onFocus={() => { if (searchQuery.trim() && suggestions.length > 0) setShowSuggestions(true); }}
            onKeyDown={(e) => {
              if (!showSuggestions || suggestions.length === 0) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestion((p) => Math.min(p + 1, suggestions.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestion((p) => Math.max(p - 1, -1)); }
              else if (e.key === "Enter" && activeSuggestion >= 0) { e.preventDefault(); setShowSuggestions(false); router.push(`/borrowers/${suggestions[activeSuggestion].id}`); }
              else if (e.key === "Escape") { setShowSuggestions(false); }
            }}
            placeholder="Search by name or contact"
            className={formFieldInputClassName}
            aria-label="Search borrowers"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_#0f172a]">
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setShowSuggestions(false); router.push(`/borrowers/${s.id}`); }}
                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 transition-colors ${
                    i === activeSuggestion ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                  }`}
                >
                  <span className={`text-sm font-black uppercase ${
                    i === activeSuggestion ? "text-white" : "text-slate-900"
                  }`}>
                    {s.first_name} {s.last_name}
                  </span>
                  {s.contact && (
                    <span className={`shrink-0 text-[10px] tabular-nums ${
                      i === activeSuggestion ? "text-slate-300" : "text-slate-400"
                    }`}>{s.contact}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Categories
          </p>
          <button
            type="button"
            aria-expanded={isCategoryDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-900/90 bg-white px-4 py-3 text-left shadow-[2px_2px_0px_0px_rgb(15_23_42/0.85)] transition hover:bg-slate-50/90 active:translate-y-px active:shadow-[1px_1px_0px_0px_rgb(15_23_42/0.85)]"
          >
            <span className="text-sm font-bold uppercase tracking-wide text-slate-900">
              {selectedCategoryIds.length > 0
                ? `${selectedCategoryIds.length} selected`
                : "All categories"}
            </span>

            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-900/20 bg-slate-50 text-slate-700">
              <BsChevronDown
                className={`size-3.5 transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>

          {isCategoryDropdownOpen ? (
            <div
              role="listbox"
              aria-multiselectable
              className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border-2 border-slate-900/90 bg-white p-2 shadow-[3px_3px_0px_0px_rgb(15_23_42/0.18)]"
            >
              <div className="flex flex-col gap-1.5">
                {categories.map((category) => {
                  const isSelected = selectedCategoryIds.includes(category.id);

                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        const next = isSelected
                          ? selectedCategoryIds.filter((id) => id !== category.id)
                          : [...selectedCategoryIds, category.id];
                        setSelectedCategoryIds(next);
                        navigateCategories(next);
                      }}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${isSelected
                        ? "border-2 border-slate-900 bg-slate-900 text-white shadow-[1px_1px_0px_0px_rgb(15_23_42/0.5)]"
                        : "border border-slate-900/15 bg-slate-50/60 text-slate-800 shadow-[1px_1px_0px_0px_rgb(15_23_42/0.08)] hover:border-slate-900/35 hover:bg-white"
                        }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="size-3 shrink-0 rounded-full border-2 border-slate-900/25"
                          style={{
                            backgroundColor: category.color ?? "#cbd5e1",
                          }}
                        />

                        <span className="truncate capitalize">{category.name}</span>
                      </div>

                      {isSelected ? (
                        <span className="shrink-0 text-xs font-black" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {selectedCategoryIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryIds([]);
                    navigateCategories([]);
                  }}
                  className="mt-2 w-full rounded-lg border-2 border-rose-800/35 bg-rose-50 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-rose-900 shadow-[1px_1px_0px_0px_rgb(190_18_60/0.25)] transition hover:bg-rose-100/90"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {initialBorrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">
            {selectedCategoryIds.length > 0 || searchQuery.trim()
              ? "No borrowers match the current search and category filters."
              : "No borrowers yet"}
          </p>
        </div>
      ) : (
        <MasonryGrid
          borrowers={initialBorrowers}
          onBorrowerUpdated={refreshPage}
        />
      )}

      {/* Pagination controls */}
      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-center gap-2"
        >
          {currentPage > 1 ? (
            <Link
              href={buildBorrowersUrl(currentPage - 1, initialSearchQuery, selectedCategoryIds)}
              className="flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0 active:shadow-[1px_1px_0px_0px_#0f172a]"
            >
              <BsChevronLeft className="size-3" aria-hidden />
              Prev
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-400 cursor-not-allowed">
              <BsChevronLeft className="size-3" aria-hidden />
              Prev
            </span>
          )}

          <span className="rounded-lg border-2 border-slate-900 bg-slate-900 px-4 py-2 text-sm font-black tabular-nums text-white shadow-[2px_2px_0px_0px_rgb(15_23_42/0.3)]">
            {currentPage} / {totalPages}
          </span>

          {currentPage < totalPages ? (
            <Link
              href={buildBorrowersUrl(currentPage + 1, initialSearchQuery, selectedCategoryIds)}
              className="flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0 active:shadow-[1px_1px_0px_0px_#0f172a]"
            >
              Next
              <BsChevronRight className="size-3" aria-hidden />
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-400 cursor-not-allowed">
              Next
              <BsChevronRight className="size-3" aria-hidden />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function useMasonryColCount(): number {
  const [cols, setCols] = useState(0);

  useLayoutEffect(() => {
    const update = () => {
      if (window.matchMedia("(min-width: 1280px)").matches) setCols(3);
      else if (window.matchMedia("(min-width: 768px)").matches) setCols(2);
      else setCols(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cols;
}

function MasonryGrid({
  borrowers,
  onBorrowerUpdated,
}: {
  borrowers: Borrower[];
  onBorrowerUpdated: () => void;
}) {
  const colCount = useMasonryColCount();

  if (colCount === 0) {
    return (
      <div className="flex flex-col gap-4 w-full">
        {borrowers.map((borrower) => (
          <BorrowerCard
            key={borrower.id}
            borrower={borrower}
            showScheduleSummary
            onBorrowerUpdated={onBorrowerUpdated}
          />
        ))}
      </div>
    );
  }

  const columns: Borrower[][] = Array.from({ length: colCount }, () => []);
  borrowers.forEach((b, i) => columns[i % colCount].push(b));

  return (
    <div className="flex gap-4 items-start w-full">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-4 flex-1 min-w-0">
          {col.map((borrower) => (
            <BorrowerCard
              key={borrower.id}
              borrower={borrower}
              showScheduleSummary
              onBorrowerUpdated={onBorrowerUpdated}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
