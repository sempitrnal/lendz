import type { LucideIcon } from "lucide-react";
import { CardDescription, CardTitle } from "@/components/motion/card";
import { cn } from "@/lib/utils";

const TINTS = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
} as const;

/** Card title with a small tinted icon badge, shared by the dashboard sections. */
export function SectionHeading({
  icon: Icon,
  tint = "primary",
  title,
  subtitle,
}: {
  icon: LucideIcon;
  tint?: keyof typeof TINTS;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
          TINTS[tint],
        )}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <CardTitle as="h2" className="text-lg">
          {title}
        </CardTitle>
        {subtitle && (
          <CardDescription className="leading-normal">
            {subtitle}
          </CardDescription>
        )}
      </div>
    </div>
  );
}
