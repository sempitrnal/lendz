"use client";

import { FaPlus } from "react-icons/fa6";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/modal";
import AccountForm from "@/components/forms/account-form";
import AccountCardMenu from "@/components/borrower/account-card-menu";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { BorrowerSummary } from "./borrower-detail-view";
import { supabase } from "@/lib/supabase/client";
import NotesCanvas from "./notes-canvas";
export type AccountRow = {
  id: string;
  type: string;
  status: string;
  principal_amount: number | string | null;
  interest_rate: number | string | null;
};

type BorrowerAccountsSectionProps = {
  borrowerId: string;
  accounts: AccountRow[] | null;
  borrower?: BorrowerSummary
};
function AccountCard({
  account,
  router,
  isOpening,
  onOpen,
}: {
  account: AccountRow;
  router: AppRouterInstance;
  isOpening: boolean;
  onOpen: (id: string) => void;
}) {


  return <div
    className={`flex gap-2 rounded-xl border bg-white p-4 transition ${isOpening ? "opacity-70" : "hover:border-black/20 hover:shadow-sm"
      }`}
  >
    <button
      type="button"
      onClick={() => onOpen(account.id)}
      disabled={isOpening}
      className="min-w-0 flex-1 cursor-pointer text-left"
      aria-label={`Open account for ${account.type.replace("_", " ")}`}
      aria-busy={isOpening}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium capitalize">
            {account.type.replace("_", " ")}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Status: {account.status}
          </p>
        </div>

        <div className="text-right">
          <p className="font-semibold">
            ₱
            {Number(
              account.principal_amount
            ).toLocaleString()}
          </p>

          <p className="text-sm text-gray-500">
            {account.interest_rate}% interest
          </p>
          {isOpening ? (
            <p className="mt-1 text-xs font-medium text-slate-600">
              Opening account...
            </p>
          ) : null}
        </div>
      </div>
    </button>
    <AccountCardMenu accountId={account.id} />
  </div>
}
export default function BorrowerAccountsSection({
  borrowerId,
  accounts,
  borrower
}: BorrowerAccountsSectionProps) {
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [openingAccountId, setOpeningAccountId] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  const router = useRouter();
  const [notes, setNotes] = useState<any[]>([]);
  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from("borrower_notes")
      .select("*")
      .eq("borrower_id", borrowerId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setNotes(data || []);
  };
  const deleteNote = async (id: string) => {
    const confirmed = window.confirm(
      "Delete this note?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("borrower_notes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    setNotes((prev) =>
      prev.filter((n) => n.id !== id)
    );

    setIsNotesOpen(false);
    setSelectedNote(null);
  };
  const [selectedNote, setSelectedNote] =
    useState<any | null>(null);

  const [isNotesOpen, setIsNotesOpen] =
    useState(false);
  const handleOpenAccount = (id: string) => {
    setOpeningAccountId(id);
    router.push(`/accounts/${id}`);
  };



  useEffect(() => {
    fetchNotes();
  }, [borrowerId]);
  return (
    <div className="rounded-lg  ">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Accounts</h2>

          <p className="text-sm text-gray-500">
            Loans and cash advances
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddAccountOpen(true)}
          className="rounded-full"
          aria-label="Add account"
        >
          <FaPlus className="bg-green-400 rounded-full text-indigo-950 hover:opacity-90 transition w-6 h-6 p-1 shadow-[2px_2px_0px_0px_#1e293b] cursor-pointer hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-[4px_4px_0px_0px_#1e293b]" />
        </button>
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-gray-500">No accounts yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              router={router}
              isOpening={openingAccountId === account.id}
              onOpen={handleOpenAccount}
            />
          ))}
        </div>
      )}

      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>add account</DialogTitle>
          </DialogHeader>

          <AccountForm
            borrowerId={borrowerId}
            onSuccess={() => setIsAddAccountOpen(false)}
          />
        </DialogContent>
      </Dialog>
      {/* <NotesCanvas borrowerId={borrowerId} initialData={borrower?.notes_canvas} /> */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Notes
          </h2>

          <button
            onClick={() => {
              setSelectedNote(null);
              setIsNotesOpen(true);
            }}
            className="
        rounded-lg
        border
        bg-yellow-200
        px-4
        py-2
        text-sm
        shadow-sm
      "
          >
            New note
          </button>
        </div>

        <div
          className="
    w-full
    "
        >
          {notes.map((note, i) => (
            <button
              key={note.id}
              onClick={() => {
                setSelectedNote(note);
                setIsNotesOpen(true);
              }}
              style={{
                // left: note.x,
                // top: note.y,
                // rotate: `${i % 2 === 0 ? -2 : 2}deg`,
              }}
              className="
          overflow-hidden
          rounded-sm
          w-full
          p-3
          
          shadow-md
          transition
          hover:scale-[1.02]
        "
            >
              {note.preview_image ? (
                <img
                  src={note.preview_image}
                  className="pointer-events-none rounded w-full"
                />
              ) : (
                <div className="h-20 " />
              )}
            </button>
          ))}
        </div>
      </div>

      <Dialog
        open={isNotesOpen}
        onOpenChange={setIsNotesOpen}
      >
        <DialogContent className="max-w-5xl">
          <div className="flex items-center justify-between mt-10">
            <DialogHeader className="">
              <DialogTitle>
                {selectedNote
                  ? "Edit note"
                  : "New note"}
              </DialogTitle>
            </DialogHeader>

            {selectedNote && (
              <button
                onClick={() =>
                  deleteNote(selectedNote.id)
                }
                className="
        rounded-md
        border
        border-red-200
        bg-red-50
        px-3
        py-1
        text-sm
        text-red-600
        hover:bg-red-100
      "
              >
                Delete
              </button>
            )}
          </div>

          <NotesCanvas
            borrowerId={borrowerId}
            note={selectedNote}
            onSaved={(newNote) => {
              if (selectedNote) {
                setNotes((prev) =>
                  prev.map((n) =>
                    n.id === newNote.id ? newNote : n
                  )
                );
              } else {
                setNotes((prev) => [...prev, newNote]);
              }

              setIsNotesOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
