import {
  CalendarRange,
  UserPlus,
  Tags,
  CalendarClock,
  ScrollText,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { DashCard } from "./dash-card";

const quickActions = [
  {
    label: "add borrower",
    icon: UserPlus,
    href: "/borrowers",
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "manage categories",
    icon: Tags,
    href: "/categories",
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    label: "upcoming due dates",
    icon: CalendarClock,
    href: "/upcoming",
    tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    label: "audit trail",
    icon: ScrollText,
    href: "/audit",
    tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    label: "reset cache",
    icon: RefreshCw,
    href: "#",
    tint: "bg-secondary text-muted-foreground",
  },
];

export function SidePanel({
  dueThisMonthSchedules,
}: {
  dueThisMonthSchedules: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <DashCard
        className="relative overflow-hidden rounded-xl border border-border
          bg-primary p-6 text-primary-foreground"
      >
        <CalendarRange
          className="pointer-events-none absolute -right-6 -bottom-6 size-36
            rotate-[-12deg] text-primary-foreground/10"
          aria-hidden="true"
        />
        <div className="flex items-center gap-2">
          <CalendarRange className="size-5" aria-hidden="true" />
          <h2 className="text-lg font-semibold">due this month</h2>
        </div>
        <p className="mt-4 text-4xl font-semibold tracking-tight">
          {dueThisMonthSchedules}
        </p>
        <p className="text-sm text-primary-foreground/80">schedules</p>
        <p className="mt-3 text-sm leading-relaxed text-primary-foreground/80">
          View all payment schedules due within the current calendar month,
          grouped by borrower.
        </p>
        <Link
          href="/due-this-month"
          className="relative mt-4 inline-flex w-full items-center
            justify-center gap-1 rounded-lg bg-primary-foreground/15 px-4 py-2
            text-sm font-medium transition-colors
            hover:bg-primary-foreground/25"
        >
          View all
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </DashCard>

      <DashCard className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          quick actions
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {quickActions.map((action) => (
            <li key={action.label}>
              <Link
                href={action.href}
                className="group flex w-full items-center justify-between
                  rounded-lg border border-border bg-card px-4 py-3 text-left
                  text-sm font-medium text-card-foreground transition-colors
                  hover:bg-secondary"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex size-8 items-center justify-center
                    rounded-md transition-transform group-hover:scale-110
                    ${action.tint}`}
                  >
                    <action.icon className="size-4" aria-hidden="true" />
                  </span>
                  {action.label}
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground transition-transform
                    group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </DashCard>
    </div>
  );
}
