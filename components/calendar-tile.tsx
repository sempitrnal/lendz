import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const SIZES = {
  md: { box: "w-11", band: "text-[9px]", day: "text-lg" },
  sm: { box: "w-9", band: "text-[9px]", day: "text-sm" },
} as const;

/**
 * A small calendar page: month over day. The year is deliberately not on the
 * tile — callers put it in the text beside it when it isn't this year.
 * `date` is `YYYY-MM-DD` (read as written, no timezone shifts).
 */
export function CalendarTile({
  date,
  size = "md",
  className,
  bandClassName = "bg-sky-200 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  title,
}: {
  date: string;
  size?: keyof typeof SIZES;
  /** Extra classes for the tile itself (border colour, alignment). */
  className?: string;
  /** Colours of the month band. */
  bandClassName?: string;
  title?: string;
}) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const s = SIZES[size];
  return (
    <div
      title={title ?? `${MONTHS[month - 1]} ${day}, ${year}`}
      className={cn(
        `shrink-0 overflow-hidden rounded-lg border border-sky-200 bg-white
        text-center dark:border-sky-900/50 dark:bg-card`,
        s.box,
        className,
      )}
    >
      <div
        className={cn(
          "py-px font-bold whitespace-nowrap",
          s.band,
          bandClassName,
        )}
      >
        {MONTHS[month - 1]}
      </div>
      <div
        className={cn(
          `py-0.5 leading-tight font-black text-[#556477] tabular-nums
          dark:text-foreground`,
          s.day,
        )}
      >
        {day}
      </div>
    </div>
  );
}
