"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import MonthView from "./month-view";
import AddEventModal from "./add-event-modal";
import type { CalendarEventRow } from "@/lib/cache/calendar-events";
import NeobrutButton from "@/components/neobrut-button";

type BorrowerOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type AccountOption = {
  id: string;
  principal_amount: number | null;
  status: string;
};

type CalendarPageClientProps = {
  year: number;
  month: number;
  events: CalendarEventRow[];
  borrowers: BorrowerOption[];
  accountsByBorrower: Record<string, AccountOption[]>;
  createEventAction: (formData: FormData) => Promise<{ error?: string }>;
  deleteEventAction: (formData: FormData) => Promise<{ error?: string }>;
};

export default function CalendarPageClient({
  year,
  month,
  events,
  borrowers,
  accountsByBorrower,
  createEventAction,
  deleteEventAction,
}: CalendarPageClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 px-2 sm:gap-6 sm:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-wide text-slate-900 sm:text-2xl">
          calendar
        </h1>
        <NeobrutButton variant="green" onClick={() => setModalOpen(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" />
            schedule
          </span>
        </NeobrutButton>
      </div>
      <MonthView initialYear={year} initialMonth={month} events={events} deleteEventAction={deleteEventAction} />
      <AddEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        borrowers={borrowers}
        accountsByBorrower={accountsByBorrower}
        onSubmit={async (data) => {
          const form = new FormData();
          form.append("borrower_id", data.borrower_id);
          if (data.account_id) form.append("account_id", data.account_id);
          form.append("event_date", data.event_date);
          form.append("amount", String(data.amount));
          if (data.title) form.append("title", data.title);
          if (data.note) form.append("note", data.note);
          return createEventAction(form);
        }}
      />
    </div>
  );
}
