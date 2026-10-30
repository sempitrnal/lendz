"use client";

import {
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { Share2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type ShareSchedule = {
  index: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining: number;
  status: string;
  paid_date: string | null;
};

type Props = {
  borrowerName: string;
  accountType: string;
  releaseDate: string | null;
  collected: number;
  remaining: number;
  progressPct: number;
  schedules: ShareSchedule[];
  noDetails?: boolean;
  /** Manual accounts: rows are payments received, not fixed installments. */
  isManual?: boolean;
  /** Leave out the button: something else (a menu item) calls `capture`. */
  hideTrigger?: boolean;
  controlRef?: Ref<ShareScheduleControl>;
};

export type ShareScheduleControl = { capture: () => void };

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

/** A status's colours: the row tint, its mark, and its text. */
function statusPalette(status: string, dark: boolean) {
  const table: Record<
    string,
    [string, string, string, string, string, string]
  > = {
    //        light row, mark,      text,      dark row,  mark,      text
    paid: ["#ecfdf5", "#10b981", "#059669", "#10241c", "#34d399", "#6ee7b7"],
    partial: ["#f5f3ff", "#8b5cf6", "#7c3aed", "#1d1830", "#a78bfa", "#c4b5fd"],
    overdue: ["#fff1f2", "#f43f5e", "#e11d48", "#2a1519", "#fb7185", "#fda4af"],
    due: ["#fffbeb", "#f59e0b", "#b45309", "#2a2210", "#fbbf24", "#fcd34d"],
    pending: ["#f8fafc", "#cbd5e1", "#8391a5", "#232327", "#52525b", "#a1a1aa"],
  };
  const row = table[status] ?? table.pending;
  const [rowBg, mark, text] = dark ? row.slice(3) : row;
  return { rowBg, mark, text };
}

function dueLabel(dueDate: string, status: string) {
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (status === "overdue" || days < 0) {
    const n = Math.abs(days);
    return { text: `${n} day${n === 1 ? "" : "s"} overdue`, tone: "overdue" };
  }
  if (days === 0) return { text: "due today", tone: "pending" };
  return { text: `in ${days} day${days === 1 ? "" : "s"}`, tone: "pending" };
}

const light = {
  pageBg: "#eef2ef",
  cardBg: "#ffffff",
  textPrimary: "#334155",
  textMuted: "#8391a5",
  textFaint: "#a9b4c4",
  line: "#e2e8f0",
  tile: "#f8fafc",
};

const dark = {
  pageBg: "#0c0c0e",
  cardBg: "#18181b",
  textPrimary: "#f4f4f5",
  textMuted: "#a1a1aa",
  textFaint: "#71717a",
  line: "#27272a",
  tile: "#202024",
};

function downloadImage(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

/** Payments per image once a schedule is split. */
const PAGE_SIZE = 16;

/** The schedule as images: one when it fits, else runs of `PAGE_SIZE`. */
function pagesOf<T>(rows: T[]): T[][] {
  if (rows.length <= PAGE_SIZE) return [rows];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    pages.push(rows.slice(i, i + PAGE_SIZE));
  }
  return pages;
}

/** "2026-10-19" → "Oct 19": the year is already on the due date beside it. */
function shortDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** The app's band colours right now (the accent can change). */
function readBrand() {
  const css = getComputedStyle(document.documentElement);
  return {
    a: css.getPropertyValue("--page-1").trim() || "#059669",
    b: css.getPropertyValue("--page-2").trim() || "#10b981",
  };
}

export default function ShareScheduleButton({
  borrowerName,
  accountType,
  releaseDate,
  collected,
  remaining,
  progressPct,
  schedules,
  noDetails,
  isManual,
  hideTrigger,
  controlRef,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [brand, setBrand] = useState({ a: "#059669", b: "#10b981" });

  const p = isDark ? dark : light;

  const paidCount = schedules.filter((s) => s.status === "paid").length;
  const nextRow = schedules.find((s) => s.status !== "paid");
  const overdueCount = schedules.filter((s) => s.status === "overdue").length;
  // A long schedule goes out as several images of up to 16 payments each.
  const pages = pagesOf(schedules);
  const pageCount = pages.length;
  const [page, setPage] = useState(0);
  const rows = pages[page] ?? [];
  const first = page === 0;
  // The next payment's card is the first image's; later ones are just rows.
  const showNext = first ? nextRow : undefined;
  const twoColumns = rows.length > 8;

  const capture = useCallback(async () => {
    const darkActive =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    flushSync(() => {
      setIsDark(darkActive);
      setBrand(readBrand());
      setShowCard(true);
      setRendering(true);
    });

    // Wait for fonts/layout to settle
    await new Promise((r) => setTimeout(r, 100));

    if (!cardRef.current) {
      setRendering(false);
      setShowCard(false);
      return;
    }

    try {
      // Loaded on first use; it is only needed once someone shares.
      const { toPng } = await import("html-to-image");
      const urls: string[] = [];
      for (let i = 0; i < pageCount; i++) {
        flushSync(() => setPage(i));
        await new Promise((r) => setTimeout(r, 50));
        if (!cardRef.current) break;
        urls.push(
          await toPng(cardRef.current, {
            pixelRatio: 2,
            backgroundColor: darkActive ? dark.pageBg : light.pageBg,
          }),
        );
      }
      // e.g. "JAMIELYN-PONTERAS-2026-10-04-schedule.png" (the release date).
      const base = [
        borrowerName.trim().replace(/\s+/g, "-"),
        releaseDate?.slice(0, 10),
      ]
        .filter(Boolean)
        .join("-");
      const nameOf = (i: number) =>
        urls.length > 1
          ? `${base}-schedule-${i + 1}-of-${urls.length}.png`
          : `${base}-schedule.png`;

      // Try Web Share API first (mobile), fall back to download
      const files = await Promise.all(
        urls.map(async (url, i) => {
          const blob = await (await fetch(url)).blob();
          return new File([blob], nameOf(i), { type: "image/png" });
        }),
      );
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files })
      ) {
        await navigator.share({
          files,
          title: `${borrowerName} — Payment Schedule`,
        });
      } else {
        urls.forEach((url, i) => downloadImage(url, nameOf(i)));
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled the share dialog — not an error
      } else {
        console.error("Failed to capture image:", err);
      }
    } finally {
      setRendering(false);
      setShowCard(false);
      setPage(0);
    }
  }, [borrowerName, releaseDate, pageCount]);

  useImperativeHandle(controlRef, () => ({ capture: () => void capture() }), [
    capture,
  ]);

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={capture}
          disabled={rendering}
          className="dark:border-border dark:bg-card dark:text-foreground
            dark:hover:bg-muted flex items-center gap-1.5 rounded border
            border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold
            text-slate-600 transition hover:bg-slate-50 active:translate-y-px
            active:shadow-none"
        >
          {rendering ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <Share2 className="size-3.5" />
          )}
          {rendering ? "Generating…" : noDetails ? "share" : "Share"}
        </button>
      )}

      {/* Off-screen card used for image capture */}
      {showCard ? (
        <div
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            zIndex: -1,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <div
            ref={cardRef}
            style={{
              width: 720,
              padding: 28,
              fontFamily:
                'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              backgroundColor: p.pageBg,
              color: p.textPrimary,
            }}
          >
            <div
              style={{
                borderRadius: 32,
                overflow: "hidden",
                backgroundColor: p.cardBg,
                boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
              }}
            >
              {/* The band: who, what, and how far along. Later images get a
                  slim strip saying which payments they hold. */}
              {first ? (
                <div
                  style={{
                    // Room at the bottom for the next payment to overlap.
                    padding: showNext ? "28px 32px 64px" : "28px 32px 32px",
                    color: "#ffffff",
                    backgroundImage: `linear-gradient(160deg, ${brand.a}, ${brand.b})`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        letterSpacing: "-0.02em",
                        opacity: 0.9,
                      }}
                    >
                      utangz
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        padding: "6px 12px",
                        borderRadius: 999,
                        backgroundColor: "rgba(255,255,255,0.2)",
                      }}
                    >
                      {accountType.replace("_", " ")}
                      {releaseDate ? ` · ${formatDate(releaseDate)}` : ""}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 18,
                      fontSize: 30,
                      fontWeight: 900,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.1,
                    }}
                  >
                    {borrowerName.toLowerCase()}
                  </div>
                  <div
                    style={{
                      marginTop: 18,
                      fontSize: 13,
                      fontWeight: 600,
                      opacity: 0.85,
                    }}
                  >
                    {remaining > 0 ? "Remaining balance" : "Balance"}
                  </div>
                  <div
                    style={{
                      fontSize: 46,
                      fontWeight: 900,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {remaining > 0 ? formatMoney(remaining) : "Fully paid"}
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.25)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, progressPct))}%`,
                        borderRadius: 999,
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      opacity: 0.9,
                    }}
                  >
                    <span>{formatMoney(collected)} collected</span>
                    <span>
                      {isManual
                        ? `${schedules.length} payment${schedules.length === 1 ? "" : "s"}`
                        : `${paidCount} of ${schedules.length} paid`}{" "}
                      · {progressPct}%
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "22px 32px",
                    color: "#ffffff",
                    backgroundImage: `linear-gradient(160deg, ${brand.a}, ${brand.b})`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}
                    >
                      utangz
                    </div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {borrowerName.toLowerCase()}
                    </div>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "6px 12px",
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.2)",
                    }}
                  >
                    payments {rows[0]?.index}–{rows.at(-1)?.index}
                  </span>
                </div>
              )}

              <div style={{ padding: "0 24px 20px" }}>
                {/* What to pay next, lifted onto the band's edge. */}
                {showNext
                  ? (() => {
                      const due = dueLabel(showNext.due_date, showNext.status);
                      const st = statusPalette(
                        due.tone === "overdue" ? "overdue" : "due",
                        isDark,
                      );
                      const amount =
                        showNext.remaining > 0
                          ? showNext.remaining
                          : showNext.amount_due;
                      return (
                        <div
                          style={{
                            marginTop: -40,
                            marginBottom: 12,
                            borderRadius: 24,
                            backgroundColor: st.rowBg,
                            border: `2px solid ${st.mark}`,
                            boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
                            padding: "16px 20px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 14,
                            }}
                          >
                            <span
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 14,
                                backgroundColor: st.mark,
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                fontWeight: 800,
                              }}
                            >
                              #{showNext.index}
                            </span>
                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: st.text,
                                }}
                              >
                                Next payment · {formatDate(showNext.due_date)}
                              </div>
                              <div
                                style={{
                                  marginTop: 2,
                                  fontSize: 28,
                                  fontWeight: 800,
                                  letterSpacing: "-0.02em",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {formatMoney(amount)}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                display: "inline-block",
                                padding: "6px 14px",
                                borderRadius: 999,
                                backgroundColor: st.mark,
                                color: "#ffffff",
                                fontSize: 13,
                                fontWeight: 800,
                              }}
                            >
                              {due.text}
                            </div>
                            {overdueCount > 1 ? (
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: st.text,
                                }}
                              >
                                +{overdueCount - 1} more overdue
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()
                  : null}

                {/* Every payment, as one list. */}
                <div
                  style={{
                    marginTop: showNext ? 0 : 20,
                    display: "grid",
                    gridTemplateColumns: twoColumns ? "1fr 1fr" : "1fr",
                    // Two columns read down, then across.
                    gridTemplateRows: twoColumns
                      ? `repeat(${Math.ceil(rows.length / 2)}, auto)`
                      : undefined,
                    gridAutoFlow: twoColumns ? "column" : undefined,
                    columnGap: 20,
                  }}
                >
                  {rows.map((s, i) => {
                    const isNext = nextRow?.index === s.index;
                    const tone = isNext
                      ? s.status === "overdue"
                        ? "overdue"
                        : "due"
                      : s.status;
                    const st = statusPalette(tone, isDark);
                    const partialPct =
                      s.amount_due > 0
                        ? Math.min(
                            100,
                            Math.round((s.amount_paid / s.amount_due) * 100),
                          )
                        : 0;
                    const filled =
                      s.status === "paid" || s.status === "overdue";
                    const perColumn = twoColumns
                      ? Math.ceil(rows.length / 2)
                      : rows.length;
                    const lastInColumn =
                      (i + 1) % perColumn === 0 || i === rows.length - 1;
                    return (
                      <div
                        key={s.index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 4px",
                          borderBottom: lastInColumn
                            ? "none"
                            : `1px solid ${p.line}`,
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            borderRadius: 999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            backgroundColor: filled ? st.mark : "transparent",
                            border: filled ? "none" : `2px solid ${st.mark}`,
                            color: filled ? "#ffffff" : st.text,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {s.status === "paid"
                            ? "✓"
                            : s.status === "overdue"
                              ? "!"
                              : s.index}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatMoney(s.amount_due)}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: p.textMuted,
                              marginTop: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {formatDate(s.due_date)}
                            {s.status === "paid" && s.paid_date
                              ? ` · paid ${shortDate(s.paid_date)}`
                              : ""}
                            {s.status === "partial"
                              ? ` · ${partialPct}% paid`
                              : ""}
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            padding: "4px 10px",
                            borderRadius: 999,
                            backgroundColor: st.rowBg,
                            fontSize: 11,
                            fontWeight: 800,
                            color: st.text,
                          }}
                        >
                          {isNext ? "next" : s.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: p.textFaint,
              }}
            >
              {pages.length > 1 ? `${page + 1} of ${pages.length} · ` : ""}
              {isManual
                ? `${schedules.length} payment${schedules.length === 1 ? "" : "s"} received`
                : `${paidCount} of ${schedules.length} paid`}{" "}
              · made with utangz
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
