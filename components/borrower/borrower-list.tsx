"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formFieldInputClassName } from "@/lib/form-field-classes";
import AddBorrowerModal from "./add-borrower-modal";

type Borrower = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  created_at: string;
};

function BorrowerCard({ borrower }: { borrower: Borrower }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          router.push(`/borrowers/${borrower.id}`);
        })
      }
      className="w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-black/20 hover:shadow-md cursor-pointer disabled:cursor-wait disabled:opacity-80"
      aria-busy={isPending}
      aria-label={`Open ${borrower.first_name} ${borrower.last_name}`}
    >
      <div className="rounded-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {borrower.first_name} {borrower.last_name}
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              {borrower.contact || "No contact"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          Created{" "}
          {new Date(borrower.created_at).toLocaleDateString()}
          {isPending ? (
            <span className="text-gray-600">Opening...</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function BorrowersList() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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
      .select("*")
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

  if (loading) {
    return (
      <div className="">
        <AddBorrowerModal getBorrowers={getBorrowers} openModal={openAddBorrowerModal} isOpen={isAddBorrowerModalOpen} onClose={closeAddBorrowerModal} />
        <p>Loading borrowers...</p>
      </div>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredBorrowers = borrowers.filter((borrower) => {
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

      <div className="mb-6">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or contact"
          className={formFieldInputClassName}
          aria-label="Search borrowers"
        />
      </div>

      {borrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">No borrowers yet</p>
        </div>
      ) : filteredBorrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">
            No borrowers found for &quot;{searchQuery.trim()}&quot;
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