"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { neobrutButtonClassName } from "@/components/neobrut-button";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
  floating?: boolean;
};

export default function BackButton({
  fallbackHref = "/",
  label = "Back",
  className,
  floating = false,
}: BackButtonProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!floating) return;

    const onScroll = () => {
      setVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(true), 300);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [floating]);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  if (floating) {
    if (!mounted) return null;
    return createPortal(
      <button
        type="button"
        onClick={handleBack}
        aria-label={label}
        className={`fixed top-20 left-4 z-50 inline-flex items-center gap-2 transition-all duration-300 print:hidden ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        } ${neobrutButtonClassName("white", "")}`}
      >
        <span aria-hidden="true">←</span>
        <span>{label}</span>
      </button>,
      document.body
    );
  }

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
