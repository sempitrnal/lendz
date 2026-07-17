"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";

import { Checkbox } from "../ui/checkbox";
import { Borrower } from "../borrower/borrower-list";
import { supabase } from "@/lib/supabase/client";

type AssignBorrowerProps = {
  categoryId: string;
  initialAssigned?: Borrower[];
};
export default function AssignBorrower({
  categoryId,
  initialAssigned,
}: AssignBorrowerProps) {
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);

  const [selected, setSelected] = useState<string[]>(
    initialAssigned?.map((b) => b.id) ?? [],
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [borrowerMap, setBorrowerMap] = useState<Record<string, Borrower>>({});
  const assignBorrowers = async () => {
    // remove all current links first
    await supabase
      .from("borrower_categories")
      .delete()
      .eq("category_id", categoryId);

    // insert fresh state
    if (selected.length) {
      const rows = selected.map((id) => ({
        borrower_id: id,
        category_id: categoryId,
      }));

      await supabase.from("borrower_categories").insert(rows);
    }

    setOpen(false);
    router.refresh();
  };
  const searchBorrowers = async (value: string) => {
    setSearch(value);

    setLoading(true);

    const { data } = await supabase
      .from("borrowers")
      .select("id, first_name, last_name, contact")
      .or(`first_name.ilike.%${value}%,last_name.ilike.%${value}%`)
      .is("deleted_at", null)
      .limit(50);

    setBorrowers((data ?? []) as Borrower[]);

    const map: Record<string, Borrower> = {};

    data?.forEach((b: Borrower) => {
      map[b.id] = b as Borrower;
    });

    setBorrowerMap((prev) => ({ ...prev, ...map }));
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      searchBorrowers("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900
            px-3.5 py-2 text-sm font-medium text-white transition-colors
            hover:bg-slate-700 dark:bg-foreground dark:text-background
            dark:hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Assign Borrowers
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign borrowers</DialogTitle>
        </DialogHeader>
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((id) => {
            const b = borrowerMap[id];
            if (!b) return null;

            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded bg-black px-2 py-1
                  text-xs text-white"
              >
                {b.first_name} {b.last_name}
                <button
                  onClick={() =>
                    setSelected((prev) => prev.filter((x) => x !== id))
                  }
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        {/* COMMAND INSIDE DIALOG */}
        <Command>
          <CommandInput
            placeholder="Search borrowers..."
            value={search}
            onValueChange={searchBorrowers}
          />

          {/* <CommandEmpty>No borrowers found</CommandEmpty> */}
          <CommandList className="mt-5">
            {loading && (
              <div className="p-2 text-sm text-gray-500">Loading...</div>
            )}

            {!loading && borrowers.length === 0 && (
              <CommandEmpty>No borrowers found</CommandEmpty>
            )}

            {borrowers
              .filter((b) => !selected.includes(b.id))
              .map((b) => (
                <CommandItem
                  key={b.id}
                  onSelect={() => {
                    setSelected((prev) =>
                      prev.includes(b.id)
                        ? prev.filter((id) => id !== b.id)
                        : [...prev, b.id],
                    );
                  }}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    checked={selected.includes(b.id)}
                    onCheckedChange={(checked) => {
                      setSelected((prev) =>
                        checked
                          ? [...prev, b.id]
                          : prev.filter((id) => id !== b.id),
                      );
                    }}
                  />
                  <span>
                    {b.first_name} {b.last_name}
                  </span>
                </CommandItem>
              ))}
          </CommandList>
        </Command>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <div
            className="rounded-full border border-emerald-200 bg-emerald-50 px-2
              py-1 font-medium text-emerald-700"
          >
            Selected: {selected.length}
          </div>

          <div
            className="rounded-full border border-slate-200 bg-slate-100 px-2
              py-1 font-medium text-slate-700"
          >
            Search Results: {borrowers.length}
          </div>

          <div
            className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1
              font-medium text-blue-700"
          >
            Available To Assign:{" "}
            {borrowers.filter((b) => !selected.includes(b.id)).length}
          </div>
        </div>
        {/* ACTION BUTTONS */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded border px-3 py-1"
          >
            Cancel
          </button>

          <button
            onClick={assignBorrowers}
            className="rounded bg-black px-3 py-1 text-white"
          >
            Assign
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
