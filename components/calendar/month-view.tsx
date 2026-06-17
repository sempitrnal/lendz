"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, CalendarDays } from "lucide-react";
import { useState, useTransition, useMemo, useEffect, useRef } from "react";
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
import { formatDate, isDarkColor } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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
      return "bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-[#0f2417] dark:text-[#56d364] dark:border-[#2ea043]";
    case "cancelled":
      return "bg-slate-100 text-slate-500 border-slate-300 line-through dark:bg-[#21262d] dark:text-[#8b949e] dark:border-[#30363d]";
    default:
      return "bg-sky-100 text-sky-900 border-sky-400 dark:bg-[#0c1d2b] dark:text-[#79c0ff] dark:border-[#58a6ff]";
  }
}

function borrowerName(evt: CalendarEventRow) {
  const b = evt.borrower;
  return b ? `${b.first_name} ${b.last_name}` : "Unknown";
}

function borrowerCategories(evt: CalendarEventRow) {
  const bc = evt.borrower?.borrower_categories;
  if (!bc || bc.length === 0) return [];
  return bc.map((row) => row.category).filter(Boolean);
}

export default function MonthView({
  initialYear,
  initialMonth,
  events,
  deleteEventAction,
}: MonthViewProps) {
  const router = useRouter();
  const year = initialYear;
  const month = initialMonth;
  const [isPending, startTransition] = useTransition();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRow | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);

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

  const goToMonth = (y: number, m: number) => {
    router.push(`/calendar?year=${y}&month=${m}`);
  };

  const prevMonth = () => {
    goToMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  };

  const nextMonth = () => {
    goToMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  };

  const weeks = useMemo(() => {
    const d = getDaysInMonth(year, month);
    const fd = getFirstDayOfMonth(year, month);
    const cells: (number | null)[] = Array(fd).fill(null);
    for (let i = 1; i <= d; i++) cells.push(i);
    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [year, month]);

  const [activeWeek, setActiveWeek] = useState(0);
  const directionRef = useRef<"prev" | "next" | null>(null);
  const jumpTargetRef = useRef<{
    year: number;
    month: number;
    day: number;
  } | null>(null);

  useEffect(() => {
    if (jumpTargetRef.current) {
      const { year: jy, month: jm, day: jd } = jumpTargetRef.current;
      if (year === jy && month === jm) {
        const idx = weeks.findIndex((w) => w.includes(jd));
        setActiveWeek(idx >= 0 ? idx : 0);
      }
      jumpTargetRef.current = null;
      return;
    }
    if (directionRef.current === "prev") {
      setActiveWeek(Math.max(0, weeks.length - 1));
    } else if (directionRef.current === "next") {
      setActiveWeek(0);
    } else {
      const idx = weeks.findIndex((w) => w.includes(today.getDate()));
      setActiveWeek(idx >= 0 ? idx : 0);
    }
    directionRef.current = null;
  }, [weeks]);

  const prevWeek = () => {
    if (activeWeek > 0) {
      setActiveWeek((w) => w - 1);
    } else {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      directionRef.current = "prev";
      router.push(`/calendar?year=${prevYear}&month=${prevMonth}`);
    }
  };

  const nextWeek = () => {
    if (activeWeek < weeks.length - 1) {
      setActiveWeek((w) => w + 1);
    } else {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      directionRef.current = "next";
      router.push(`/calendar?year=${nextYear}&month=${nextMonth}`);
    }
  };

  const jumpToDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (year === y && month === m) {
      const idx = weeks.findIndex((w) => w.includes(day));
      if (idx >= 0) setActiveWeek(idx);
    } else {
      jumpTargetRef.current = { year: y, month: m, day };
      router.push(`/calendar?year=${y}&month=${m}`);
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
      {/* Desktop month header */}
      <div className="hidden items-center justify-between sm:flex">
        <h1
          className="dark:text-foreground text-xl font-black tracking-wide
            text-slate-600 uppercase"
        >
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="dark:border-border dark:bg-card dark:text-foreground
              rounded-lg border-2 border-slate-900 bg-white px-2 py-1
              text-slate-600 shadow-[2px_2px_0px_0px_#0f172a]
              transition-transform hover:-translate-y-0.5 active:translate-y-0
              active:shadow-none"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const n = new Date();
              router.push(
                `/calendar?year=${n.getFullYear()}&month=${n.getMonth() + 1}`,
              );
            }}
            className="dark:border-border dark:bg-card dark:text-foreground
              rounded-lg border-2 border-slate-900 bg-white px-3 py-1 text-xs
              font-black tracking-wider text-slate-600 uppercase
              shadow-[2px_2px_0px_0px_#0f172a] transition-transform
              hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            today
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="dark:border-border dark:bg-card dark:text-foreground
              rounded-lg border-2 border-slate-900 bg-white px-2 py-1
              text-slate-600 shadow-[2px_2px_0px_0px_#0f172a]
              transition-transform hover:-translate-y-0.5 active:translate-y-0
              active:shadow-none"
          >
            <ChevronRight className="size-5" />
          </button>
          <label
            htmlFor="calendar-date-picker"
            className="dark:border-border dark:bg-card dark:text-foreground
              cursor-pointer rounded-lg border-2 border-slate-900 bg-white px-2
              py-1 text-slate-600 shadow-[2px_2px_0px_0px_#0f172a]
              transition-transform hover:-translate-y-0.5 active:translate-y-0
              active:shadow-none"
            aria-label="Jump to date"
          >
            <CalendarDays className="size-5" />
          </label>
        </div>
      </div>

      {/* Mobile week header */}
      <div className="flex items-center justify-between sm:hidden">
        <button
          type="button"
          onClick={prevWeek}
          className="dark:border-border dark:bg-card dark:text-foreground
            rounded-lg border-2 border-slate-900 bg-white px-2 py-1
            text-slate-600 shadow-[2px_2px_0px_0px_#0f172a] transition-transform
            hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-center">
          <h1
            className="dark:text-foreground text-lg font-black tracking-wide
              text-slate-600 uppercase"
          >
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          <div className="flex items-center justify-center gap-1.5">
            <p
              className="dark:text-muted-foreground text-[10px] font-black
                tracking-wider text-slate-500 uppercase"
            >
              week {activeWeek + 1} of {weeks.length}
            </p>
            <label
              htmlFor="calendar-date-picker"
              className="dark:border-border dark:text-muted-foreground
                cursor-pointer rounded border border-slate-300 p-0.5
                text-slate-500 transition hover:border-slate-600
                hover:text-slate-600"
              aria-label="Jump to date"
            >
              <CalendarDays className="size-3" />
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={nextWeek}
          className="dark:border-border dark:bg-card dark:text-foreground
            rounded-lg border-2 border-slate-900 bg-white px-2 py-1
            text-slate-600 shadow-[2px_2px_0px_0px_#0f172a] transition-transform
            hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <input
        id="calendar-date-picker"
        type="date"
        className="pointer-events-none absolute opacity-0"
        style={{ width: 0, height: 0 }}
        onChange={(e) => {
          if (e.target.value) jumpToDate(e.target.value);
        }}
      />

      {/* Mobile week view */}
      <div className="flex flex-col gap-3 sm:hidden">
        {weeks[activeWeek]?.map((day, idx) => {
          const dayEvents = day ? (eventsByDay[day] ?? []) : [];
          const isTodayDay = day !== null && isToday(day);
          return (
            <div
              key={idx}
              className={`rounded-xl border-2 p-3
              shadow-[2px_2px_0px_0px_#0f172a] dark:shadow-none ${
                day
                  ? "dark:border-border dark:bg-card border-slate-900 bg-white"
                  : `dark:border-border/30 dark:bg-muted border-slate-200
                    bg-slate-50`
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="dark:text-muted-foreground text-[10px] font-black
                    tracking-wider text-slate-500 uppercase"
                >
                  {WEEKDAYS[idx]}
                </span>
                {day ? (
                  <span
                    className={`inline-flex size-6 items-center justify-center
                      rounded-full text-xs font-bold ${
                        isTodayDay
                          ? `dark:bg-foreground dark:text-background
                            bg-slate-900 text-white`
                          : "dark:text-foreground text-slate-600"
                      }`}
                  >
                    {day}
                  </span>
                ) : (
                  <span
                    className="dark:text-muted-foreground text-xs
                      text-slate-300"
                  >
                    —
                  </span>
                )}
                {isTodayDay && (
                  <span
                    className="dark:bg-foreground dark:text-background rounded
                      bg-slate-900 px-1.5 py-0.5 text-[8px] font-black
                      tracking-wider text-white uppercase"
                  >
                    today
                  </span>
                )}
              </div>
              {day && dayEvents.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {dayEvents.map((evt) => {
                    const isDeleting = deletingIds.has(evt.id);
                    const cats = borrowerCategories(evt);
                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => {
                          setSelectedEvent(evt);
                          setDialogOpen(true);
                        }}
                        className={`relative w-full rounded-lg border-2 px-3
                        py-2 text-left text-xs font-bold transition-opacity
                        hover:opacity-80 ${statusColor(evt.status)}
                        ${isDeleting ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{borrowerName(evt)}</span>
                          {deleteEventAction && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(evt.id);
                              }}
                              className="dark:text-foreground/60 shrink-0
                                rounded-full p-1 text-slate-600/60
                                hover:bg-red-200 hover:text-red-700
                                dark:hover:bg-red-900/30
                                dark:hover:text-red-400"
                              aria-label="Delete event"
                            >
                              <X className="size-3" />
                            </span>
                          )}
                        </div>
                        {evt.amount > 0 && (
                          <span className="mt-0.5 block text-[10px] opacity-80">
                            ₱{evt.amount.toLocaleString()}
                          </span>
                        )}
                        {cats.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {cats.map((c) => (
                              <span
                                key={c.id}
                                className={`rounded border border-slate-900/30
                                px-1 py-0.5 text-[8px] font-black
                                ${isDarkColor(c.color) ? "text-white" : "text-slate-600"}`}
                                style={{ backgroundColor: c.color }}
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {day && dayEvents.length === 0 && (
                <p
                  className="dark:text-muted-foreground mt-2 text-xs
                    text-slate-300"
                >
                  No events
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop month grid */}
      <div
        className="dark:border-border dark:bg-card hidden rounded-xl border-2
          border-slate-900 bg-white shadow-[4px_4px_0px_0px_#0f172a] sm:block"
      >
        <div
          className="dark:border-border grid grid-cols-7 border-b-2
            border-slate-900"
        >
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="dark:text-muted-foreground px-2 py-2 text-center
                text-[11px] font-black tracking-wider text-slate-500 uppercase"
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid auto-rows-fr grid-cols-7">
          {cells.map((day, idx) => {
            const dayEvents = day ? (eventsByDay[day] ?? []) : [];
            const visibleEvents = dayEvents.slice(0, 3);
            const moreCount = dayEvents.length - visibleEvents.length;
            return (
              <div
                key={idx}
                className={`dark:border-border/30 min-h-[120px] border-r
                border-b border-slate-200 p-1.5 last:border-r-0 ${
                  day
                    ? "dark:bg-card bg-white"
                    : "dark:bg-muted/50 bg-slate-50/50"
                }
                ${isToday(day ?? 0) ? "bg-green-50 dark:bg-emerald-900/20" : ""}`}
              >
                {day ? (
                  <div className="flex h-full flex-col">
                    <button
                      type="button"
                      onClick={() => {
                        if (dayEvents.length > 0) {
                          setSelectedDay(day);
                          setDayDialogOpen(true);
                        }
                      }}
                      className="mb-1 self-start"
                    >
                      <span
                        className={`inline-flex size-6 items-center
                          justify-center rounded-full text-xs font-bold ${
                            isToday(day)
                              ? `dark:bg-foreground dark:text-background
                                bg-slate-900 text-white`
                              : "dark:text-foreground text-slate-700"
                          }`}
                      >
                        {day}
                      </span>
                    </button>
                    <div className="flex flex-1 flex-col gap-1">
                      {visibleEvents.map((evt) => {
                        const isDeleting = deletingIds.has(evt.id);
                        return (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => {
                              setSelectedEvent(evt);
                              setDialogOpen(true);
                            }}
                            className={`group relative w-full rounded-md border
                              px-1.5 py-1 text-left text-[10px] leading-tight
                              font-bold transition-opacity hover:opacity-80
                              ${statusColor(evt.status)}
                              ${isDeleting ? "opacity-40" : ""}`}
                          >
                            <span className="block truncate pr-4">
                              {borrowerName(evt)}
                            </span>
                            {deleteEventAction && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(evt.id);
                                }}
                                className="absolute top-0.5 right-0.5 hidden
                                  items-center justify-center rounded-full p-0.5
                                  text-slate-600/60 group-hover:flex
                                  hover:bg-red-200 hover:text-red-700"
                                aria-label="Delete event"
                              >
                                <X className="size-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {moreCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDay(day);
                            setDayDialogOpen(true);
                          }}
                          className="dark:border-border
                            dark:text-muted-foreground dark:hover:border-border
                            dark:hover:text-foreground mt-auto rounded-md border
                            border-dashed border-slate-300 py-1 text-center
                            text-[10px] font-bold text-slate-400 transition
                            hover:border-slate-400 hover:text-slate-600"
                        >
                          +{moreCount} more
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className="dark:text-foreground text-sm font-black tracking-wide
                text-slate-600 uppercase"
            >
              {selectedEvent?.title || "scheduled event"}
            </DialogTitle>
          </DialogHeader>

          {selectedEvent && (
            <div
              className="dark:text-muted-foreground flex flex-col gap-2 text-sm
                text-slate-700"
            >
              {selectedEvent.account?.status === "pending" && (
                <div
                  className="rounded-lg border-2 border-amber-600 bg-amber-50
                    p-2 text-center dark:border-amber-700 dark:bg-amber-900/30"
                >
                  <p
                    className="text-[10px] font-black tracking-widest
                      text-amber-800 uppercase dark:text-amber-300"
                  >
                    pending loan
                  </p>
                  <p
                    className="text-xs font-bold text-amber-700
                      dark:text-amber-400"
                  >
                    ₱
                    {Number(
                      selectedEvent.account.principal_amount ?? 0,
                    ).toLocaleString()}{" "}
                    principal
                  </p>
                </div>
              )}
              <p>
                <span
                  className="dark:text-muted-foreground text-[10px] font-bold
                    tracking-wider text-slate-500 uppercase"
                >
                  borrower
                </span>
                <span
                  className="dark:text-foreground ml-2 font-black
                    text-slate-600"
                >
                  {borrowerName(selectedEvent)}
                </span>
              </p>
              {(() => {
                const cats = selectedEvent
                  ? borrowerCategories(selectedEvent)
                  : [];
                if (cats.length === 0) return null;
                return (
                  <p className="flex flex-wrap gap-1">
                    {cats.map((c) => (
                      <span
                        key={c.id}
                        className={`rounded border border-slate-900/30 px-1.5 py-0.5 text-[10px] font-black ${isDarkColor(c.color) ? "text-white" : "text-slate-600"}`}
                        style={{ backgroundColor: c.color }}
                      >
                        {c.name}
                      </span>
                    ))}
                  </p>
                );
              })()}
              <p>
                <span
                  className="dark:text-muted-foreground text-[10px] font-bold
                    tracking-wider text-slate-500 uppercase"
                >
                  date
                </span>
                <span
                  className="dark:text-foreground ml-2 font-bold text-slate-600"
                >
                  {formatDate(selectedEvent.event_date)}
                </span>
              </p>
              {selectedEvent.amount > 0 ? (
                <p>
                  <span
                    className="dark:text-muted-foreground text-[10px] font-bold
                      tracking-wider text-slate-500 uppercase"
                  >
                    amount
                  </span>
                  <span
                    className="dark:text-foreground ml-2 font-bold
                      text-slate-600"
                  >
                    ₱{selectedEvent.amount.toLocaleString()}
                  </span>
                </p>
              ) : null}
              {selectedEvent.note ? (
                <p className="dark:text-muted-foreground text-xs text-slate-500">
                  {selectedEvent.note}
                </p>
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
            {selectedEvent?.account?.status === "pending" &&
              selectedEvent.account_id && (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day View Dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className="dark:text-foreground text-sm font-black tracking-wide
                text-slate-600 uppercase"
            >
              {selectedDay
                ? formatDate(
                    `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`,
                  )
                : "Day events"}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (
            <div className="flex flex-col gap-3">
              {(eventsByDay[selectedDay] ?? []).length === 0 ? (
                <p
                  className="dark:text-muted-foreground text-center text-sm
                    text-slate-400"
                >
                  No events for this day
                </p>
              ) : (
                (eventsByDay[selectedDay] ?? []).map((evt) => {
                  const isDeleting = deletingIds.has(evt.id);
                  const cats = borrowerCategories(evt);
                  return (
                    <div
                      key={evt.id}
                      className={`relative rounded-lg border-2 p-3
                        ${statusColor(evt.status).replace( "border-",
                        "border- border-2", )}
                        ${isDeleting ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEvent(evt);
                            setDayDialogOpen(false);
                            setDialogOpen(true);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className="dark:text-foreground text-sm font-black
                              text-slate-600"
                          >
                            {borrowerName(evt)}
                          </p>
                          {evt.title ? (
                            <p
                              className="dark:text-muted-foreground text-xs
                                font-bold text-slate-500"
                            >
                              {evt.title}
                            </p>
                          ) : null}
                          {evt.amount > 0 ? (
                            <p
                              className="dark:text-foreground mt-1 text-xs
                                font-black text-slate-600"
                            >
                              ₱{evt.amount.toLocaleString()}
                            </p>
                          ) : null}
                          {cats.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {cats.map((c) => (
                                <span
                                  key={c.id}
                                  className={`rounded border border-slate-900/30
                                    px-1.5 py-0.5 text-[9px] font-black
                                    ${isDarkColor(c.color) ? "text-white" : "text-slate-600"}`}
                                  style={{ backgroundColor: c.color }}
                                >
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                        {deleteEventAction && (
                          <button
                            type="button"
                            onClick={() => handleDelete(evt.id)}
                            disabled={isDeleting}
                            className="shrink-0 rounded-full p-1 text-slate-400
                              transition hover:bg-red-100 hover:text-red-600
                              dark:hover:bg-red-900/30"
                            aria-label="Delete event"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      {evt.account?.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => {
                            router.push(`/accounts/${evt.account_id}`);
                            setDayDialogOpen(false);
                          }}
                          className="mt-2 w-full rounded-md border-2
                            border-amber-600 bg-amber-50 py-1.5 text-center
                            text-[10px] font-black tracking-wider text-amber-800
                            uppercase transition hover:bg-amber-100
                            dark:border-amber-700 dark:bg-amber-900/30
                            dark:text-amber-300 dark:hover:bg-amber-900/50"
                        >
                          activate pending loan
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
