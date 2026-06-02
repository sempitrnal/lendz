"use client";

import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} style={{ animation: "fade-in 240ms ease-out both" }}>
      {children}
    </div>
  );
}
