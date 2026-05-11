"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formFieldInputClassName } from "@/lib/form-field-classes";
import AddBorrowerModal from "./add-borrower-modal";
import { BorrowerCard } from "./borrower-card";
import { BsChevronDown } from "react-icons/bs";

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
};



export default function BorrowersList() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isAddBorrowerModalOpen, setIsAddBorrowerModalOpen] = useState(false)
  function openAddBorrowerModal() {
    setIsAddBorrowerModalOpen(true)
  }
  function closeAddBorrowerModal() {
    setIsAddBorrowerModalOpen(false)
  }
  const getBorrowers = async () => {
    const { data, error } = await supabase
      .from("borrowers")
      .select(`
        *,
        borrower_categories (
          category:categories (
            id,
            name,
            color
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setBorrowers(data || []);
    setLoading(false);
  };
  useEffect(() => {


    getBorrowers();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredBorrowers = borrowers.filter((borrower) => {
    const matchesCategory =
      selectedCategoryIds.length === 0 ||
      borrower.borrower_categories?.some((bc) =>
        selectedCategoryIds.includes(bc.category?.id)
      );

    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const fullName =
      `${borrower.first_name} ${borrower.last_name}`.toLowerCase();
    const contact = (borrower.contact ?? "").toLowerCase();

    return (
      fullName.includes(normalizedQuery) ||
      borrower.first_name.toLowerCase().includes(normalizedQuery) ||
      borrower.last_name.toLowerCase().includes(normalizedQuery) ||
      contact.includes(normalizedQuery)
    );
  });
  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>();

    borrowers.forEach((borrower) => {
      borrower.borrower_categories?.forEach((bc) => {
        if (bc.category && !map.has(bc.category.id)) {
          map.set(bc.category.id, bc.category);
        }
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [borrowers]);

  if (loading) {
    return (
      <div className="">
        <AddBorrowerModal getBorrowers={getBorrowers} openModal={openAddBorrowerModal} isOpen={isAddBorrowerModalOpen} onClose={closeAddBorrowerModal} />
        <p>Loading borrowers...</p>
      </div>
    );
  }


  return (
    <div className="">
      <AddBorrowerModal getBorrowers={getBorrowers} openModal={openAddBorrowerModal} isOpen={isAddBorrowerModalOpen} onClose={closeAddBorrowerModal} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Borrowers</h1>
          <p className="text-sm text-gray-500">
            Manage borrower records
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or contact"
          className={formFieldInputClassName}
          aria-label="Search borrowers"
        />

        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setIsCategoryDropdownOpen((prev) => !prev)
            }
            className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50"
          >
            <span>
              {selectedCategoryIds.length > 0
                ? `${selectedCategoryIds.length} categor${selectedCategoryIds.length === 1 ? "y" : "ies"} selected`
                : "Filter by categories"}
            </span>

            <BsChevronDown
              className={`transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCategoryDropdownOpen ? (
            <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="flex flex-col gap-1">
                {categories.map((category) => {
                  const isSelected = selectedCategoryIds.includes(category.id);

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== category.id)
                            : [...prev, category.id]
                        );
                      }}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-transparent hover:bg-slate-100"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border"
                          style={{
                            backgroundColor:
                              category.color ?? "#cbd5e1",
                          }}
                        />

                        <span>{category.name}</span>
                      </div>

                      {isSelected ? <span>✓</span> : null}
                    </button>
                  );
                })}
              </div>

              {selectedCategoryIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryIds([])}
                  className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {borrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">No borrowers yet</p>
        </div>
      ) : filteredBorrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">
            No borrowers match the current search and category filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredBorrowers.map((borrower) => (
            <BorrowerCard

              key={borrower.id}
              borrower={borrower}
            />
          ))}
        </div>
      )}
    </div>
  );
}