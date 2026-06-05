"use client";

import { ReactNode, useEffect, useId, useState } from "react";

type ModalSize = "xs" | "sm" | "md" | "lg" | "xl";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  size?: ModalSize;
  className?: string;
};

const sizeClassMap: Record<ModalSize, string> = {
  xs: "max-w-sm",
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  size = "md",
  className = "",
}: ModalProps) {
  const titleId = useId();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const transitionMs = 200;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timeout = window.setTimeout(() => {
      setShouldRender(false);
    }, transitionMs);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (!shouldRender) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 pt-6 transition-opacity duration-200 ${
        isVisible ? "bg-black/50 opacity-100" : "bg-black/0 opacity-0"
      }`}
      onClick={closeOnOverlayClick ? onClose : undefined}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[calc(100dvh-3rem)] w-full flex-col rounded-xl bg-white shadow-xl transition-all duration-200 dark:bg-[#1e1e1e] dark:shadow-none ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        } ${sizeClassMap[size]} ${className}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          {title ? (
            <h2
              id={titleId}
              className="text-lg font-semibold text-stone-900 dark:text-zinc-100"
            >
              {title}
            </h2>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md px-2 py-1 text-sm text-stone-600 transition-colors hover:bg-slate-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-slate-800 dark:hover:text-zinc-100"
            aria-label="Close modal"
          >
            close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
