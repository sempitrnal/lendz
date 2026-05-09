"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Borrower = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  created_at: string;
};

function BorrowerCard({ borrower }: { borrower: Borrower }) {
  return (
    <Link href={`/borrowers/${borrower.id}`}>
      <div className="rounded-lg border p-4 shadow-sm bg-white transition hover:shadow-md hover:border-black/20 cursor-pointer">
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

        <div className="mt-4 text-xs text-gray-400">
          Created{" "}
          {new Date(borrower.created_at).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}

export default function BorrowersList() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getBorrowers = async () => {
      const { data, error } = await supabase
        .from("borrowers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setBorrowers(data || []);
      setLoading(false);
    };

    getBorrowers();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading borrowers...</p>
      </div>
    );
  }

  return (
    <div className="pt-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Borrowers</h1>
          <p className="text-sm text-gray-500">
            Manage borrower records
          </p>
        </div>
      </div>

      {borrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">No borrowers yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {borrowers.map((borrower) => (
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