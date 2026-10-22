import Link from "next/link";
import { TOURS } from "@/lib/tours/tours";

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function WhatsNewPage() {
  const tours = [...TOURS].reverse();
  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="text-2xl font-semibold tracking-tight">What&apos;s new</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Replay a walkthrough of any update.
      </p>
      {tours.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nothing new yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {tours.map((tour) => (
            <li
              key={tour.id}
              className="flex items-center gap-3 rounded-2xl border
                border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{tour.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(tour.date)} · {tour.steps.length} step
                  {tour.steps.length === 1 ? "" : "s"}
                </p>
              </div>
              {tour.page.endsWith("/*") ? (
                // No single page to send them to: it plays on any of them.
                <span className="text-xs text-muted-foreground">
                  Plays when you open one
                </span>
              ) : (
                <Link
                  href={`${tour.page}?${
                    tour.replayQuery ? `${tour.replayQuery}&` : ""
                  }tour=${tour.id}`}
                  className="rounded-full border border-border px-3 py-1.5
                    text-sm font-medium active:bg-muted"
                >
                  Replay
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
