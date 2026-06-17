import type { ComponentPropsWithoutRef } from "react";

export type NeobrutButtonVariant = "green" | "white" | "red" | "yellow";

const BASE =
  "cursor-pointer rounded-lg border border-indigo-950 px-4 py-2 text-sm font-black lowercase tracking-wide text-slate-600 shadow-[6px_6px_0px_0px_#1e293b] transition hover:-translate-y-0.5 hover:translate-x-0.5 hover:opacity-90 hover:shadow-[4px_4px_0px_0px_#1e293b] disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_CLASS: Record<NeobrutButtonVariant, string> = {
  green: "bg-green-300",
  white: "bg-white",
  red: "bg-red-400",
  yellow: "bg-yellow-300",
};

/** Use on `<button>` or `<Link>` (e.g. `className={neobrutButtonClassName("white")}`). */
export function neobrutButtonClassName(
  variant: NeobrutButtonVariant = "green",
  className?: string,
): string {
  return [BASE, VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
}

export type NeobrutButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: NeobrutButtonVariant;
};

export default function NeobrutButton({
  variant = "green",
  className,
  ...props
}: NeobrutButtonProps) {
  return (
    <button className={neobrutButtonClassName(variant, className)} {...props} />
  );
}
