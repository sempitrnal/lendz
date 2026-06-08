"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const key = (path: string) => `scroll:${path}`;

export function ScrollRestoration() {
  const pathname = usePathname();
  const wasBack = useRef(false);

  // Take over scroll restoration from the browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Detect back/forward navigation via popstate
  useEffect(() => {
    function onPopState() {
      wasBack.current = true;
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

  // On pathname change: restore if back nav, else scroll to top
  useEffect(() => {
    if (wasBack.current) {
      wasBack.current = false;
      const saved = sessionStorage.getItem(key(pathname));
      if (saved) {
        // Delay to ensure Next.js internal scroll-to-top has finished
        setTimeout(() => {
          window.scrollTo({ top: parseInt(saved, 10), behavior: "instant" });
        }, 50);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
