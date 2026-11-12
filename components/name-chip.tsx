import { tint } from "@/lib/category-tint";

/**
 * A borrower's name as a pill: tinted and outlined in their category's
 * colour, or a plain neutral one without a colour.
 */
export function NameChip({
  name,
  color,
}: {
  name: string | null;
  color: string | null;
}) {
  return (
    <span className="block">
      <span
        className="inline-block max-w-full truncate rounded-full border
          border-border bg-muted/50 px-2 align-top text-[13px] leading-5
          font-bold text-card-foreground/80"
        style={{
          backgroundColor: tint(color, 0.15),
          borderColor: tint(color, 0.5),
        }}
      >
        {name ?? "unknown borrower"}
      </span>
    </span>
  );
}
