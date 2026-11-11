"use client";

// THROWAWAY PROTOTYPE: fake pages, a green banner that swells into a splash
// while the next page loads, then shrinks back. Two triggers to compare.
import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type PageKey = "dashboard" | "checklist" | "borrowers";
type Variant = "slow" | "every";

const NAV: { key: PageKey; label: string; Icon: typeof Users }[] = [
  { key: "dashboard", label: "dashboard", Icon: LayoutDashboard },
  { key: "checklist", label: "checklist", Icon: ClipboardCheck },
  { key: "borrowers", label: "borrowers", Icon: Users },
];

/** Height of each page's green band; 0 = the page has none (white header). */
const BAND: Record<PageKey, number> = {
  dashboard: 230,
  checklist: 250,
  borrowers: 0,
};

const EXPAND_MS = 520;
const COLLAPSE_MS = 560;
/** The panel's bottom corners; it is this much taller than the screen. */
const RADIUS = 28;
/** "Only when slow": the splash starts once a page is this late. */
const SLOW_AFTER_MS = 150;
/** Once the splash is up it stays at least this long, so it never flashes. */
const MIN_HOLD_MS = 350;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

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

type Shape = "band" | "full" | "gone";

/**
 * Where the green panel sits. It is a full-height slab hung from the top, so
 * sliding it with `transform` (compositor only, no repaint per frame) shows
 * as much of it as the band needs, with the rounded edge staying round.
 */
function transformFor(shape: Shape, bandPx: number) {
  if (shape === "full") return "translate3d(0, 0, 0)";
  if (shape === "gone") return "translate3d(0, -100%, 0)";
  return `translate3d(0, calc(-100% + ${bandPx}px), 0)`;
}

function FakePage({ page }: { page: PageKey }) {
  const green = BAND[page] > 0;
  const title =
    page === "dashboard"
      ? "Good morning"
      : page === "checklist"
        ? "THU, OCT 29"
        : "Borrowers";
  return (
    <div className="page-fade min-h-full pb-64">
      {green ? (
        <div
          className="rounded-b-[28px] bg-linear-to-b from-emerald-600
            to-emerald-500 px-5 pt-24 text-white"
          style={{ height: BAND[page] }}
        >
          <p className="text-xs font-semibold tracking-wide opacity-80">
            {title}
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            {page === "dashboard" ? "₱8,387,547" : "₱1,260,440.78"}
          </p>
          <p className="mt-1 text-sm opacity-80">
            {page === "dashboard" ? "outstanding" : "left · 4/76 paid"}
          </p>
        </div>
      ) : (
        <div className="px-5 pt-24">
          <p className="text-3xl font-bold tracking-tight">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">128 people</p>
        </div>
      )}
      <div className={cn("space-y-3 px-4", green ? "-mt-8" : "mt-5")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm
              ring-1 ring-black/5"
          >
            <span className="size-10 shrink-0 rounded-full bg-secondary" />
            <div className="min-w-0 flex-1 space-y-2">
              <span className="block h-3 w-2/5 rounded bg-secondary" />
              <span className="block h-2.5 w-3/5 rounded bg-secondary/70" />
            </div>
            <span className="h-3 w-14 rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Segment<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange(v: T): void;
  options: [T, string][];
}) {
  return (
    <div className="flex rounded-xl bg-secondary p-0.5 text-xs font-semibold">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 rounded-[10px] px-2 py-1.5 transition-colors",
            v === value ? "bg-card shadow-sm" : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function TransitionMockup() {
  // On document.body: the app's layout traps fixed children under its bars.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [page, setPage] = useState<PageKey>("dashboard");
  const [variant, setVariant] = useState<Variant>("slow");
  const [loadMs, setLoadMs] = useState(1200);
  const [active, setActive] = useState(false);
  const [shape, setShape] = useState<Shape>("band");
  const [bandPx, setBandPx] = useState(BAND.dashboard);
  const [loadingFor, setLoadingFor] = useState<PageKey>("dashboard");
  const busy = useRef(false);
  const panel = useRef<HTMLDivElement>(null);

  const go = async (to: PageKey) => {
    if (busy.current || to === page) return;
    busy.current = true;
    const started = performance.now();
    const showSplash = variant === "every" || loadMs > SLOW_AFTER_MS;

    if (!showSplash) {
      // Fast enough: the page just swaps, no splash.
      await sleep(loadMs);
      setPage(to);
      busy.current = false;
      return;
    }

    if (variant === "slow") await sleep(SLOW_AFTER_MS);
    setLoadingFor(to);
    const from = BAND[page];
    setBandPx(from);
    setShape(from === 0 ? "gone" : "band");
    setActive(true);
    await frame();
    await frame();
    setShape("full");
    await settle(panel.current, EXPAND_MS);

    // Loading: wait for the page, but never flash.
    const waited = performance.now() - started;
    await sleep(Math.max(MIN_HOLD_MS, loadMs - waited));

    setPage(to);
    await frame();
    const into = BAND[to];
    setBandPx(into);
    setShape(into === 0 ? "gone" : "band");
    await settle(panel.current, COLLAPSE_MS);
    setActive(false);
    busy.current = false;
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-hidden bg-background">
      <div className="h-full overflow-y-auto">
        <FakePage key={page} page={page} />
      </div>

      {/* The persistent top bar of the real app, simplified. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex h-16 items-center",
          "px-5 text-sm font-semibold",
          BAND[page] > 0 ? "text-white" : "text-foreground",
        )}
      >
        search borrowers…
      </div>

      {/* The splash: a green slab that slides down over the page. */}
      <div
        ref={panel}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: `calc(100% + ${RADIUS}px)`,
          // The band's own gradient sits in the slab's last bandPx, so the
          // hand-off to the page's real band shows no change of colour.
          background: `linear-gradient(to bottom, #059669 calc(100% - ${bandPx}px), #10b981 100%)`,
          borderRadius: `0 0 ${RADIUS}px ${RADIUS}px`,
          visibility: active ? "visible" : "hidden",
          transform: transformFor(shape, bandPx),
          transition: `transform ${shape === "full" ? EXPAND_MS : COLLAPSE_MS}ms ${EASE}`,
          willChange: "transform",
        }}
      />
      {/* Its loader stays put and fades, apart from the sliding slab. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center",
          "justify-center transition-opacity",
          shape === "full" && active
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
            opening {loadingFor}…
          </p>
        </div>
      </div>

      {/* Controls and the nav sit above the splash so you can keep testing. */}
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 p-4 pb-6">
        <div
          className="space-y-2 rounded-2xl bg-card p-3 shadow-lg ring-1
            ring-black/10"
        >
          <Segment<Variant>
            value={variant}
            onChange={setVariant}
            options={[
              ["slow", "Only when slow"],
              ["every", "Every switch"],
            ]}
          />
          <Segment<number>
            value={loadMs}
            onChange={setLoadMs}
            options={[
              [80, "Fast page 80ms"],
              [1200, "Slow page 1.2s"],
            ]}
          />
          <p className="text-[11px] text-muted-foreground">
            {variant === "slow"
              ? "Splash only if the page is later than 150ms."
              : "Splash on every switch, even a fast one."}
          </p>
        </div>
        <div
          className="flex justify-around rounded-full bg-card p-2 shadow-lg
            ring-1 ring-black/10"
        >
          {NAV.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => void go(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm",
                "font-semibold transition-colors",
                page === key
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
