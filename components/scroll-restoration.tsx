"use client";

import { useEffect } from "react";

export function ScrollRestoration() {
  // TEMP: test Next.js native scroll restoration
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.scrollRestoration = "auto";
      console.log("[scroll-debug] native scrollRestoration set to auto");
    }
  }, []);

  return null;
}
