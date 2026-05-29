"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { CalendarEventRow } from "@/lib/cache/calendar-events";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NeobrutButton from "@/components/neobrut-button";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type MonthViewProps = {
  initialYear: number;
  initialMonth: number;
  events: CalendarEventRow[];
  deleteEventAction?: (formData: FormData) => Promise<{ error?: string }>;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-900 border-emerald-400";
    case "cancelled":
      return "bg-slate-100 text-slate-500 border-slate-300 line-through";
    default:
      return "bg-sky-100 text-sky-900 border-sky-400";
  }
}

function borrowerName(evt: CalendarEventRow) {
  const b = evt.borrower;
  return b ? `${b.first_name} ${b.last_name}` : "Unknown";
}

export default function MonthView({
  initialYear,
  initialMonth,
  events,
  deleteEventAction,
}: MonthViewProps) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [isPending, startTransition] = useTransition();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDelete = (id: string) => {
    if (!deleteEventAction || isPending) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    const form = new FormData();
    form.append("id", id);
    startTransition(async () => {
      await deleteEventAction(form);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() + 1 &&
    year === today.getFullYear();

  const eventsByDay: Record<number, CalendarEventRow[]> = {};
  for (const evt of events) {
    const day = Number(evt.event_date.slice(8, 10));
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(evt);
  }

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border-2 border-slate-900 bg-white px-2 py-1 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const n = new Date();
              setYear(n.getFullYear());
              setMonth(n.getMonth() + 1);
            }}
            className="rounded-lg border-2 border-slate-900 bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            today
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border-2 border-slate-900 bg-white px-2 py-1 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border-2 border-slate-900 bg-white shadow-[4px_4px_0px_0px_#0f172a]">
        <div className="grid grid-cols-7 border-b-2 border-slate-900">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="px-1 py-1.5 text-center text-[9px] font-black uppercase tracking-wider text-slate-500 sm:px-2 sm:py-2 sm:text-[11px]"
            >
              <span className="hidden sm:inline">{wd}</span>
              <span className="sm:hidden">{wd.slice(0, 1)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {cells.map((day, idx) => {
            const dayEvents = day ? eventsByDay[day] ?? [] : [];
            const visibleEvents = dayEvents.slice(0, 2);
            const moreCount = dayEvents.length - visibleEvents.length;
            return (
              <div
                key={idx}
                className={`min-h-[70px] border-r border-b border-slate-200 p-1 last:border-r-0 sm:min-h-[120px] sm:p-1.5 ${
                  day ? "bg-white" : "bg-slate-50/50"
                } ${isToday(day ?? 0) ? "bg-green-50" : ""}`}
              >
                {day ? (
                  <>
                    <span
                      className={`mb-0.5 inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold sm:mb-1 sm:size-6 sm:text-xs ${
                        isToday(day)
                          ? "bg-slate-900 text-white"
                          : "text-slate-700"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      {visibleEvents.map((evt) => {
                        const isDeleting = deletingIds.has(evt.id);
                        return (
                          <div
                            key={evt.id}
                            className={`group relative rounded border px-1 py-0.5 text-[9px] font-bold leading-tight sm:px-1.5 sm:py-1 sm:text-[10px] ${statusColor(
                              evt.status
                            )} ${isDeleting ? "opacity-40" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEvent(evt);
                                setDialogOpen(true);
                              }}
                              className="block w-full text-left transition-opacity hover:opacity-80"
                            >
                              <span className="block truncate pr-3 sm:pr-4">
                                {borrowerName(evt)}
                              </span>
                            </button>
                            {deleteEventAction && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(evt.id);
                                }}
                                disabled={isDeleting}
                                className="absolute right-0 top-0 flex items-center justify-center rounded-full p-0.5 text-slate-900/60 hover:bg-red-200 hover:text-red-700 sm:right-0.5 sm:top-0.5 sm:hidden sm:group-hover:flex"
                                aria-label="Delete event"
                              >
                                <X className="size-2.5 sm:size-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {moreCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEvent(dayEvents[0]);
                            setDialogOpen(true);
                          }}
                          className="text-[9px] font-bold text-slate-400 hover:text-slate-600 sm:text-[10px]"
                        >
                          +{moreCount} more
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wide text-slate-900">
              {selectedEvent?.title || "scheduled event"}
            </DialogTitle>
          </DialogHeader>

          {selectedEvent && (
            <div className="flex flex-col gap-2 text-sm text-slate-700">
              <p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">borrower</span>
                <span className="ml-2 font-black text-slate-900">{borrowerName(selectedEvent)}</span>
              </p>
              <p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">date</span>
                <span className="ml-2 font-bold text-slate-900">
                  {new Date(selectedEvent.event_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </p>
              {selectedEvent.amount > 0 ? (
                <p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">amount</span>
                  <span className="ml-2 font-bold text-slate-900">₱{selectedEvent.amount.toLocaleString()}</span>
                </p>
              ) : null}
              {selectedEvent.note ? (
                <p className="text-xs text-slate-500">{selectedEvent.note}</p>
              ) : null}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
            {deleteEventAction && selectedEvent && (
              <NeobrutButton
                variant="red"
                type="button"
                disabled={deletingIds.has(selectedEvent.id)}
                onClick={() => {
                  if (selectedEvent) {
                    handleDelete(selectedEvent.id);
                    setDialogOpen(false);
                    setSelectedEvent(null);
                  }
                }}
                className="w-full sm:w-auto"
              >
                {deletingIds.has(selectedEvent.id) ? "deleting..." : "delete"}
              </NeobrutButton>
            )}
            {selectedEvent?.account?.status === "pending" && selectedEvent.account_id && (
              <NeobrutButton
                variant="green"
                type="button"
                onClick={() => {
                  router.push(`/accounts/${selectedEvent.account_id}`);
                  setDialogOpen(false);
                  setSelectedEvent(null);
                }}
                className="w-full sm:w-auto"
              >
                activate account
              </NeobrutButton>
            )}
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
              close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
