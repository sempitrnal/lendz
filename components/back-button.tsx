"use client";

import { useRouter } from "next/navigation";
import { neobrutButtonClassName } from "@/components/neobrut-button";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export default function BackButton({
  fallbackHref = "/",
  label = "Back",
  className,
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // if (window.history.length > 1) {
    //   router.back();
    //   return;
    // }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={neobrutButtonClassName(
        "white",
        `inline-flex items-center gap-2 ${className ?? ""}`
      )}
      aria-label={label}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </button>
  );
}
