"use client";

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ animation: "fade-in 240ms ease-out both" }}>{children}</div>
  );
}
