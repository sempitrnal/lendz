"use client";

import { useEffect, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { HIDDEN_AMOUNT } from "@/lib/hide-amounts";
import { formatAmount, shortDate } from "@/lib/account-card/summary";
import type { BandFigures } from "@/lib/borrower/band-figures";
import BorrowerDetailMenu from "./borrower-detail-menu";
import type { BorrowerSummary } from "./borrower-detail-view";

/** Height of the app's own top bar, which stays put; the header sits under it. */
const BAR_PX = 64;
/** The body trails the page: it moves up at (1 - this) of the scroll speed. */
const PARALLAX = 0.4;
/** The folded header grows this much to fit its row of figures. */
const STATS_PX = 44;
/** The name starts this much bigger than its header size. */
const NAME_BOOST = 0.3;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type Refs = {
  head: React.RefObject<HTMLDivElement | null>;
  slab: React.RefObject<HTMLDivElement | null>;
  body: React.RefObject<HTMLDivElement | null>;
  headBg: React.RefObject<HTMLDivElement | null>;
  headStats: React.RefObject<HTMLDivElement | null>;
};

/**
 * The band folds into a fixed header under the top bar as you scroll, at the
 * page's own pace. The green slab is sticky with a negative `top`, so the
 * browser scrolls it up with your finger (no JS in that motion) until only the
 * header's height of it is left, and it stays. The header (name, categories,
 * menu) is pinned at that spot from the start and never moves. The parallax
 * is the band's contents lagging the page: the body (balance, pills, actions)
 * moves up slower than the slab and fades as it goes, the header's own green
 * fades in as the cards near it, and the name eases from bigger to header
 * size, all in step with the scroll position. Written straight to the
 * elements per frame: no re-render. On wider screens the band is a plain card.
 */
function useCollapsingBand({ head, slab, body, headBg, headStats }: Refs) {
  useEffect(() => {
    const headEl = head.current;
    const slabEl = slab.current;
    const bodyEl = body.current;
    if (!headEl || !slabEl || !bodyEl) return;
    const phone = window.matchMedia("(max-width: 639px)");
    const root = document.documentElement;
    let raf = 0;
    // How far the page scrolls before the slab has folded down to the header.
    let fold = 1;
    // The page the band sits on: padded when it's too short to scroll `fold`.
    const page = slabEl.parentElement;

    const layout = () => {
      if (!phone.matches) {
        slabEl.style.paddingTop = "";
        slabEl.style.top = "";
        if (page) page.style.minHeight = "";
        return;
      }
      const c = headEl.offsetHeight;
      // The body starts below the header, which covers the slab's top.
      const pad = `${c + 8}px`;
      if (slabEl.style.paddingTop !== pad) slabEl.style.paddingTop = pad;
      const h = slabEl.offsetHeight;
      // Sticks when only the folded header's height of the slab is left under
      // the bar: its name row plus the row of figures it grows.
      const top = `${BAR_PX + c + STATS_PX - h}px`;
      if (slabEl.style.top !== top) slabEl.style.top = top;
      fold = Math.max(1, h - c - STATS_PX);
      // A short page couldn't scroll far enough to fold the band, so it gets
      // empty room below: just enough that the document ends `fold` past one
      // screen. A longer page already is, and this changes nothing for it.
      if (page) {
        const pageTop = page.getBoundingClientRect().top + window.scrollY;
        const want = window.innerHeight + fold - pageTop;
        // Measure what the layout adds under the page (its padding, the tab
        // bar's room), on a page tall enough to be scrolling.
        page.style.minHeight = `${Math.ceil(want)}px`;
        const bottom = page.getBoundingClientRect().bottom + window.scrollY;
        const below = Math.max(0, root.scrollHeight - bottom);
        page.style.minHeight = `${Math.ceil(want - below)}px`;
      }
    };
    const paint = () => {
      raf = 0;
      if (!phone.matches) {
        bodyEl.style.opacity = "";
        bodyEl.style.transform = "";
        slabEl.style.opacity = "";
        return;
      }
      const y = window.scrollY;
      const f = clamp01(y / fold);
      // The lag: pushes the body down against the slab's upward motion.
      bodyEl.style.transform = `translate3d(0, ${Math.min(y, fold) * PARALLAX}px, 0) scale(${1 - 0.06 * f})`;
      bodyEl.style.opacity = String(1 - clamp01(f / 0.4));
      // Solid before the cards reach the header, so they slide under a cap.
      if (headBg.current) {
        headBg.current.style.opacity = String(clamp01((f - 0.2) / 0.5));
      }
      // The row of figures arrives as the header forms.
      if (headStats.current) {
        const t = clamp01((f - 0.55) / 0.35);
        headStats.current.style.opacity = String(t);
        headStats.current.style.transform = `translate3d(0, ${(1 - t) * 6}px, 0)`;
      }
      // The band is gone the moment the header is done forming: it fades out
      // over the last of the fold, leaving the header bar on its own.
      slabEl.style.opacity = String(1 - clamp01((f - 0.85) / 0.15));
      headEl.style.setProperty(
        "--name-scale",
        String(1 + NAME_BOOST * (1 - f)),
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const refresh = () => {
      layout();
      paint();
    };

    refresh();
    const ro = new ResizeObserver(refresh);
    ro.observe(headEl);
    ro.observe(slabEl);
    phone.addEventListener("change", refresh);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      phone.removeEventListener("change", refresh);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", refresh);
      if (page) page.style.minHeight = "";
    };
  }, [head, slab, body, headBg, headStats]);
}

function CategoryChips({ borrower }: { borrower: BorrowerSummary }) {
  if (!borrower.category || borrower.category.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {borrower.category.map((c) => (
        <span
          key={c.id}
          className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5
            py-0.5 text-[11px] font-semibold text-white"
        >
          <span
            className="size-2 rounded-full ring-1 ring-white/40"
            style={{ backgroundColor: c.color || "#cbd5e1" }}
          />
          {c.name}
        </span>
      ))}
    </div>
  );
}

export type BandStats = {
  profitExpected: number;
  profitCollected: number;
  toPayThisMonth: number;
  paidThisMonth: number;
};

export function BorrowerBand({
  borrower,
  figures,
  loaned,
  hide,
  onToggleHide,
  stats,
}: {
  borrower: BorrowerSummary;
  figures: BandFigures;
  loaned: number;
  hide: boolean;
  onToggleHide: () => void;
  stats: BandStats;
}) {
  const head = useRef<HTMLDivElement>(null);
  const slab = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const headBg = useRef<HTMLDivElement>(null);
  const headStats = useRef<HTMLDivElement>(null);
  useCollapsingBand({ head, slab, body, headBg, headStats });

  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  const peso = (n: number) => `₱${formatAmount(Math.round(n))}`;
  const name = `${borrower.first_name} ${borrower.last_name}`.trim();

  const menu = (
    <BorrowerDetailMenu
      onColor
      borrowerId={borrower.id}
      editBorrower={{
        initial: {
          first_name: borrower.first_name,
          last_name: borrower.last_name,
          contact: borrower.contact,
        },
        initialCategoryIds: borrower.category?.map((c) => c.id) ?? [],
      }}
    />
  );

  return (
    <>
      {/* Zero-height anchor pinned under the top bar; the header inside hangs
          from it and never moves. */}
      <div className="sticky z-30 -mx-4 h-0 sm:hidden" style={{ top: BAR_PX }}>
        <div
          ref={head}
          data-settle
          className="absolute inset-x-0 top-0 px-4 pt-1 pb-2.5 text-white"
        >
          <div
            ref={headBg}
            aria-hidden="true"
            className="absolute inset-x-0 top-0 rounded-b-3xl bg-emerald-600
              opacity-0 shadow-[0_8px_14px_-6px_rgba(2,44,34,0.35)]
              dark:bg-emerald-950"
            style={{ bottom: -STATS_PX }}
          />
          {/* Hangs below the name row; the background above reaches down to
              cover it. */}
          <div
            ref={headStats}
            className="pointer-events-none absolute inset-x-4 top-full grid
              grid-cols-4 gap-2 opacity-0"
            style={{ height: STATS_PX }}
          >
            {[
              ["Profit due", stats.profitExpected],
              ["Profit made", stats.profitCollected],
              ["To pay", stats.toPayThisMonth],
              ["Paid", stats.paidThisMonth],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0">
                <p className="truncate text-[10px] font-semibold opacity-80">
                  {label}
                </p>
                <p className="truncate text-[13px] font-black tabular-nums">
                  {mask(peso(value as number))}
                </p>
              </div>
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              {/* A scale grows the box too, and a scaled-up box past the screen
                  edge makes the page scroll sideways. The name is made
                  narrower by the same factor, so scaled it fills exactly the
                  room it has. */}
              <div className="min-w-0 flex-1">
                <p
                  className="origin-left
                    [transform:scale(var(--name-scale,1.3))]
                    [width:calc(100%/var(--name-scale,1.3))] truncate text-sm
                    font-black will-change-transform lowercase"
                >
                  {name}
                </p>
              </div>
              {menu}
            </div>
            <CategoryChips borrower={borrower} />
          </div>
        </div>
      </div>
      <div
        ref={slab}
        data-settle-group="band"
        className="sticky z-0 -mx-4 overflow-hidden px-4 text-white sm:relative
          sm:mx-0 sm:overflow-visible sm:px-5 sm:pt-5"
        style={{ top: BAR_PX - 300 }}
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="absolute inset-0 rounded-b-3xl bg-linear-to-b
            from-emerald-600 to-emerald-500 sm:rounded-3xl dark:from-emerald-950
            dark:to-emerald-900"
        />
        <div
          ref={body}
          className="relative origin-top pb-12 will-change-transform sm:pb-20"
        >
          {/* Wider screens have no top bar to dock into: the name sits here. */}
          <div className="mb-5 hidden sm:block">
            <div className="flex items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate text-lg font-black lowercase"
              >
                {name}
              </p>
              {menu}
            </div>
            <CategoryChips borrower={borrower} />
          </div>
          <div data-tour="borrower-balance">
            <button
              type="button"
              onClick={onToggleHide}
              aria-label={hide ? "Show amounts" : "Hide amounts"}
              className="flex items-center gap-2 text-xs font-semibold
                opacity-80"
            >
              Remaining balance
              {hide ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
            <p className="text-4xl font-black tracking-tight tabular-nums">
              {mask(peso(figures.remaining))}
            </p>
            <div
              role="progressbar"
              aria-valuenow={Math.round(figures.pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"
            >
              <div
                className="h-full rounded-full bg-white transition-[width]
                  duration-500"
                style={{ width: `${figures.pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs font-semibold">
              <span>{mask(peso(figures.collected))} collected</span>
              <span className="opacity-80">
                of {mask(peso(figures.totalDue))} due
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span
                className="rounded-full bg-white/20 px-2.5 py-1 text-[11px]
                  font-bold"
              >
                loaned {mask(peso(loaned))}
              </span>
              {figures.next && (
                <span
                  className="rounded-full bg-white/20 px-2.5 py-1 text-[11px]
                    font-bold"
                >
                  next {shortDate(figures.next.date)} ·{" "}
                  {mask(peso(figures.next.amount))}
                </span>
              )}
              {figures.overdueCount > 0 && (
                <span
                  className="rounded-full bg-rose-500/90 px-2.5 py-1 text-[11px]
                    font-bold"
                >
                  {figures.overdueCount} overdue
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
