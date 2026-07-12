"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";

const key = (path: string) => `scroll:${path}`;

export function ScrollRestoration() {
  const pathname = usePathname();
  const [wasBack, setWasBack] = useState(false);

  // Take over scroll restoration from the browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Detect back/forward navigation via popstate
  useEffect(() => {
    function onPopState() {
      setWasBack(true);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Save scroll position (debounced 150ms + sync on page hide)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let lastY = -1;
    function save() {
      if (window.scrollY === lastY) return;
      lastY = window.scrollY;
      clearTimeout(t);
      t = setTimeout(() => {
        sessionStorage.setItem(key(pathname), String(window.scrollY));
      }, 150);
    }
    function saveSync() {
      sessionStorage.setItem(key(pathname), String(window.scrollY));
    }
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", saveSync);
    return () => {
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", saveSync);
      clearTimeout(t);
    };
  }, [pathname]);

  // On pathname change: restore if back nav, before paint to avoid flash
  useLayoutEffect(() => {
    if (!wasBack) return;
    setWasBack(false);
    const saved = sessionStorage.getItem(key(pathname));
    if (saved) {
      window.scrollTo({ top: parseInt(saved, 10), behavior: "instant" });
    }
  }, [pathname, wasBack]);

  return null;
}
