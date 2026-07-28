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

const quickActions = [
  { label: "add borrower", icon: UserPlus, href: "/borrowers" },
  { label: "manage categories", icon: Tags, href: "/categories" },
  { label: "upcoming due dates", icon: CalendarClock, href: "/upcoming" },
  { label: "audit trail", icon: ScrollText, href: "/audit" },
  { label: "reset cache", icon: RefreshCw, href: "#" },
];

export function SidePanel({
  dueThisMonthSchedules,
}: {
  dueThisMonthSchedules: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section
        className="rounded-xl border border-border bg-primary p-6
          text-primary-foreground shadow-sm"
      >
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
          className="mt-4 inline-flex w-full items-center justify-center gap-1
            rounded-lg bg-primary-foreground/15 px-4 py-2 text-sm font-medium
            transition-colors hover:bg-primary-foreground/25"
        >
          View all
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
                    className="flex size-8 items-center justify-center
                      rounded-md bg-secondary text-primary group-hover:bg-card"
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
      </section>
    </div>
  );
}
