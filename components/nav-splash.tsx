"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_SPLASH_EVENT, navTarget, splashLabel } from "@/lib/nav-splash";

/** Once up, the splash stays at least this long, so it never flashes. */
const MIN_HOLD_MS = 350;
/** If the page never lands (offline, an error), the splash lets go anyway. */
const GIVE_UP_MS = 10_000;
const EXPAND_MS = 520;
const COLLAPSE_MS = 560;
/** The slab fades out over the page's own band, which it matches. */
const FADE_MS = 280;
/** From the slab lifting until the last card has landed (see globals.css). */
const SETTLE_MS = 1200;
/** The bands are `rounded-b-3xl`; the slab's edge matches. */
const RADIUS = 24;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

type Shape = "band" | "full" | "gone";
/**
 * idle: hidden. set: placed where the splash starts, no motion yet. cover:
 * slides over the screen. release: slides back to the new page's band. fade:
 * lets go of that band.
 */
type Phase = "idle" | "set" | "cover" | "release" | "fade";
type View = { phase: Phase; shape: Shape; bandPx: number; label: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The next painted frame; a timer backs it up for tabs that stop painting. */
const frame = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 50);
  });

/** Resolves when `el`'s transform transition ends (or a little after it should). */
const settle = (el: HTMLElement | null, ms: number) =>
  new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el?.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === "transform") finish();
    };
    el?.addEventListener("transitionend", onEnd);
    setTimeout(finish, ms + 120);
  });

/** Where the page's green band ends on screen (0: it has none in view). */
function readBand(): number {
  for (const el of document.querySelectorAll("[data-nav-band]")) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.bottom > 0) return Math.round(r.bottom);
  }
  return 0;
}

/** A route's `loading.tsx` fallback is on screen: its page has not arrived. */
const routeLoading = () => !!document.querySelector("[data-route-loading]");

/** Tells the page's marked elements where the splash is (see globals.css). */
function setSettle(state: "cover" | "release" | null) {
  if (state) document.documentElement.dataset.navSplash = state;
  else delete document.documentElement.dataset.navSplash;
}

/**
 * A full-height slab hung from the top; sliding it with `transform` (no
 * repaint per frame) shows as much of it as the band needs.
 */
function transformFor(shape: Shape, bandPx: number) {
  if (shape === "full") return "translate3d(0, 0, 0)";
  if (shape === "gone") return "translate3d(0, -100%, 0)";
  return `translate3d(0, calc(-100% + ${bandPx}px), 0)`;
}

/**
 * Every in-app navigation plays the splash (a tap on a link, or a tab that
 * announces itself): the green band swells to fill
 * the screen, waits for the new page, then shrinks into that page's band (or
 * sweeps off the top when it has none). Phones only, and not with reduced
 * motion.
 */
export function NavSplash() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const [view, setView] = useState<View>({
    phase: "idle",
    shape: "gone",
    bandPx: 0,
    label: "page",
  });
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const phone = window.matchMedia("(max-width: 639px)");
    let alive = true;
    let running = false;
    // Which run owns `data-nav-splash`; a newer tap takes it over.
    let gen = 0;

    const waitFor = (test: () => boolean, ms: number) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        const id = setInterval(() => {
          if (!alive || test() || performance.now() - t0 > ms) {
            clearInterval(id);
            resolve();
          }
        }, 50);
      });

    // The new page is in, not just its loading fallback.
    const ready = (to: string) => pathRef.current === to && !routeLoading();

    const run = async (to: string, fromBand: number) => {
      running = true;
      const mine = ++gen;
      setSettle(null);
      const label = splashLabel(to);
      setView({
        phase: "set",
        shape: fromBand > 0 ? "band" : "gone",
        bandPx: fromBand,
        label,
      });
      await frame();
      await frame();
      if (!alive) return;
      setView((v) => ({ ...v, phase: "cover", shape: "full" }));
      await settle(panel.current, EXPAND_MS);
      // Fully covered: the new page's cards wait out of sight from here.
      setSettle("cover");

      await Promise.all([
        sleep(MIN_HOLD_MS),
        waitFor(() => ready(to), GIVE_UP_MS),
      ]);
      // Let the new page lay out before measuring its band.
      await frame();
      await frame();
      if (!alive) return;
      const into = readBand();
      const lifted = performance.now();
      setSettle("release");
      setView((v) => ({
        ...v,
        phase: "release",
        shape: into > 0 ? "band" : "gone",
        bandPx: into,
      }));
      await settle(panel.current, COLLAPSE_MS);
      if (!alive) return;
      if (into > 0) {
        setView((v) => ({ ...v, phase: "fade" }));
        await sleep(FADE_MS);
        if (!alive) return;
      }
      setView((v) => ({ ...v, phase: "idle", shape: "gone" }));
      running = false;
      // The cards are still settling in: keep them marked until the last lands.
      await sleep(Math.max(0, SETTLE_MS - (performance.now() - lifted)));
      if (gen === mine) setSettle(null);
    };

    const begin = (to: string) => {
      if (running || reduce.matches || !phone.matches) return;
      if (to === pathRef.current) return;
      // Measured now: once the page changes, its band is gone.
      void run(to, readBand());
    };

    // A tap on a link: found from the click itself.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!a) return;
      const to = navTarget(
        {
          href: a.href,
          target: a.getAttribute("target"),
          hasDownload: a.hasAttribute("download"),
        },
        e,
        window.location.origin,
        pathRef.current,
      );
      if (to) begin(to);
    };

    // A tap that navigates in code (the bottom tabs) announces itself.
    const onAnnounce = (e: Event) => {
      const to = (e as CustomEvent<unknown>).detail;
      if (typeof to === "string") begin(to);
    };

    // Capture: it sees the tap before the link's own handler navigates.
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAV_SPLASH_EVENT, onAnnounce);
    return () => {
      alive = false;
      setSettle(null);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAV_SPLASH_EVENT, onAnnounce);
    };
  }, []);

  const moving = view.phase === "cover" || view.phase === "release";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[70] sm:hidden",
        view.phase === "idle" ? "pointer-events-none invisible" : "visible",
        view.phase === "fade" && "pointer-events-none",
      )}
      style={{
        opacity: view.phase === "fade" ? 0 : 1,
        transition:
          view.phase === "fade" ? `opacity ${FADE_MS}ms ease-out` : "none",
      }}
    >
      <div
        ref={panel}
        className="absolute inset-x-0 top-0 [--sp-a:#059669] [--sp-b:#10b981]
          dark:[--sp-a:#022c22] dark:[--sp-b:#064e3b]"
        style={{
          height: `calc(100% + ${RADIUS}px)`,
          borderRadius: `0 0 ${RADIUS}px ${RADIUS}px`,
          // The band's own gradient sits in the slab's last bandPx, so the
          // hand-off to the page's real band shows no change of colour.
          background: `linear-gradient(to bottom, var(--sp-a) calc(100% - ${view.bandPx}px), var(--sp-b) 100%)`,
          transform: transformFor(view.shape, view.bandPx),
          transition: moving
            ? `transform ${view.phase === "cover" ? EXPAND_MS : COLLAPSE_MS}ms ${EASE}`
            : "none",
          willChange: "transform",
        }}
      />
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "transition-opacity",
          view.phase === "cover"
            ? "opacity-100 delay-[260ms] duration-300"
            : "opacity-0 duration-150",
        )}
      >
        <div className="flex flex-col items-center gap-4 text-white">
          <p className="text-3xl font-black tracking-tight">utangz</p>
          <div className="flex gap-1.5">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="size-2 animate-bounce rounded-full bg-white/90"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
          <p className="text-xs font-semibold opacity-80">
            opening {view.label}…
          </p>
        </div>
      </div>
    </div>
  );
}
