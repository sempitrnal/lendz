"use client";

import { useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
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
  principal: number;
  collected: number;
  remaining: number;
  profit: number;
  totalPayment: number;
  progressPct: number;
  schedules: ShareSchedule[];
  noDetails?: boolean;
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

function statusPalette(status: string, dark: boolean) {
  if (dark) {
    if (status === "paid")
      return {
        rowBg: "#132a21",
        badgeBorder: "#059669",
        badgeBg: "#1a3d30",
        badgeText: "#6ee7b7",
      };
    if (status === "partial")
      return {
        rowBg: "#1f1b33",
        badgeBorder: "#7c3aed",
        badgeBg: "#2e2652",
        badgeText: "#c4b5fd",
      };
    if (status === "overdue")
      return {
        rowBg: "#2a1518",
        badgeBorder: "#e11d48",
        badgeBg: "#3d1e24",
        badgeText: "#fda4af",
      };
    return {
      rowBg: "#27272a",
      badgeBorder: "#d97706",
      badgeBg: "#2e2618",
      badgeText: "#fcd34d",
    };
  }
  if (status === "paid")
    return {
      rowBg: "#ecfdf5",
      badgeBorder: "#059669",
      badgeBg: "#d1fae5",
      badgeText: "#064e3b",
    };
  if (status === "partial")
    return {
      rowBg: "#f5f3ff",
      badgeBorder: "#7c3aed",
      badgeBg: "#ede9fe",
      badgeText: "#2e1065",
    };
  if (status === "overdue")
    return {
      rowBg: "#fff1f2",
      badgeBorder: "#e11d48",
      badgeBg: "#ffe4e6",
      badgeText: "#881337",
    };
  return {
    rowBg: "#f6f7f9",
    badgeBorder: "#d97706",
    badgeBg: "#fef3c7",
    badgeText: "#78350f",
  };
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
  if (days === 0) return { text: "Due today", tone: "pending" };
  return { text: `In ${days} day${days === 1 ? "" : "s"}`, tone: "pending" };
}

const light = {
  pageBg: "#fffefa",
  cardBg: "#f6f7f9",
  cardBorder: "#0f172a",
  cardShadow: "#0f172a",
  textPrimary: "#0f172a",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  progressBg: "#f1f5f9",
  progressFill: "#34d399",
  footerBorder: "#e2e8f0",
  watermark: "#cbd5e1",
  collected: "#059669",
  partialPct: "#d97706",
  paidDate: "#059669",
};

const dark = {
  pageBg: "#18181b",
  cardBg: "#27272a",
  cardBorder: "#3f3f46",
  cardShadow: "#18181b",
  textPrimary: "#f4f4f5",
  textSecondary: "#71717a",
  textMuted: "#a1a1aa",
  progressBg: "#27272a",
  progressFill: "#34d399",
  footerBorder: "#3f3f46",
  watermark: "#52525b",
  collected: "#34d399",
  partialPct: "#fcd34d",
  paidDate: "#6ee7b7",
};

export default function ShareScheduleButton({
  borrowerName,
  accountType,
  releaseDate,
  principal,
  collected,
  remaining,
  profit,
  totalPayment,
  progressPct,
  schedules,
  noDetails,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const p = isDark ? dark : light;

  const paidCount = schedules.filter((s) => s.status === "paid").length;
  const nextRow = schedules.find((s) => s.status !== "paid");
  const overdueCount = schedules.filter((s) => s.status === "overdue").length;
  const twoColumns = schedules.length > 6;

  const capture = useCallback(async () => {
    const darkActive =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    flushSync(() => {
      setIsDark(darkActive);
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
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: darkActive ? "#18181b" : "#fffefa",
      });

      // Try Web Share API first (mobile), fall back to download
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare
      ) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File(
          [blob],
          `${borrowerName.replace(/\s+/g, "-")}-schedule.png`,
          { type: "image/png" },
        );
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${borrowerName} — Payment Schedule`,
          });
        } else {
          downloadImage(dataUrl);
        }
      } else {
        downloadImage(dataUrl);
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
    }
  }, [borrowerName]);

  function downloadImage(dataUrl: string) {
    const link = document.createElement("a");
    link.download = `${borrowerName.replace(/\s+/g, "-")}-schedule.png`;
    link.href = dataUrl;
    link.click();
  }

  return (
    <>
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
              padding: 36,
              fontFamily:
                'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              backgroundColor: p.pageBg,
            }}
          >
            {/* Header */}
            <div
              style={{
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: p.textSecondary,
                  }}
                >
                  {accountType.replace("_", " ")}
                  {releaseDate ? ` · Released ${formatDate(releaseDate)}` : ""}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    textTransform: "capitalize",
                    color: p.textPrimary,
                    marginTop: 4,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {borrowerName.toLowerCase()}
                </div>
              </div>
              {schedules.length > 0 ? (
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 500,
                    color: p.textMuted,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontWeight: 700, color: p.textPrimary }}>
                    {paidCount}
                  </span>{" "}
                  / {schedules.length} paid
                </div>
              ) : null}
            </div>

            {/* Next due / fully paid */}
            {nextRow
              ? (() => {
                  const due = dueLabel(nextRow.due_date, nextRow.status);
                  const st = statusPalette(
                    due.tone === "overdue" ? "overdue" : nextRow.status,
                    isDark,
                  );
                  const amount =
                    nextRow.remaining > 0
                      ? nextRow.remaining
                      : nextRow.amount_due;
                  return (
                    <div
                      style={{
                        borderRadius: 12,
                        backgroundColor: st.rowBg,
                        padding: "12px 16px",
                        marginBottom: 20,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            color: p.textSecondary,
                          }}
                        >
                          Next due · #{nextRow.index}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 10,
                            marginTop: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: p.textPrimary,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatMoney(amount)}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: p.textMuted,
                            }}
                          >
                            {formatDate(nextRow.due_date)}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: st.badgeText,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              backgroundColor: st.badgeBorder,
                            }}
                          />
                          {due.text}
                        </div>
                        {overdueCount > 1 ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 9,
                              fontWeight: 500,
                              color: p.textMuted,
                            }}
                          >
                            +{overdueCount - 1} more overdue
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              : schedules.length > 0
                ? (() => {
                    const st = statusPalette("paid", isDark);
                    return (
                      <div
                        style={{
                          borderRadius: 12,
                          backgroundColor: st.rowBg,
                          padding: "12px 16px",
                          marginBottom: 20,
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: st.badgeText,
                        }}
                      >
                        Fully paid
                      </div>
                    );
                  })()
                : null}

            {!noDetails && (
              <div
                style={{
                  borderRadius: 12,
                  backgroundColor: p.cardBg,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 12,
                  }}
                >
                  {[
                    { label: "Principal", value: principal },
                    { label: "Collected", value: collected },
                    { label: "Remaining", value: remaining },
                    { label: "Profit", value: Math.max(0, profit) },
                  ].map((item) => (
                    <div key={item.label}>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: p.textSecondary,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: p.textPrimary,
                          marginTop: 2,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMoney(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: p.progressBg,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progressPct}%`,
                        backgroundColor: p.progressFill,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: p.textMuted,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {progressPct}%
                  </div>
                </div>
              </div>
            )}

            {/* Schedule label */}
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                color: p.textSecondary,
                marginBottom: 10,
              }}
            >
              Payment Schedule
            </div>

            {/* Schedule rows */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: twoColumns ? "1fr 1fr" : "1fr",
                gap: 6,
              }}
            >
              {schedules.map((s) => {
                const st = statusPalette(s.status, isDark);
                const isNext = nextRow?.index === s.index;
                const partialPct =
                  s.amount_due > 0
                    ? Math.min(
                        100,
                        Math.round((s.amount_paid / s.amount_due) * 100),
                      )
                    : 0;
                return (
                  <div
                    key={s.index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      borderRadius: 8,
                      padding: "8px 12px",
                      backgroundColor: st.rowBg,
                      boxShadow: isNext
                        ? `inset 3px 0 0 0 ${st.badgeBorder}`
                        : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        flexShrink: 0,
                        fontSize: 9,
                        fontWeight: 600,
                        color: p.textSecondary,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {s.index}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: p.textPrimary,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMoney(s.amount_due)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: p.textMuted,
                          marginTop: 1,
                        }}
                      >
                        {formatDate(s.due_date)}
                        {s.status === "paid" && s.paid_date ? (
                          <span style={{ color: p.paidDate }}>
                            {" "}
                            · paid {formatDate(s.paid_date)}
                          </span>
                        ) : null}
                        {s.status === "partial" ? (
                          <span style={{ color: p.partialPct }}>
                            {" "}
                            · {partialPct}% paid
                          </span>
                        ) : null}
                        {isNext ? (
                          <span
                            style={{ fontWeight: 700, color: st.badgeText }}
                          >
                            {" "}
                            · next
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: st.badgeText,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          backgroundColor: st.badgeBorder,
                        }}
                      />
                      {s.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: p.textMuted,
                }}
              >
                {!noDetails ? (
                  <>
                    Total{" "}
                    <span style={{ fontWeight: 700, color: p.textPrimary }}>
                      {formatMoney(totalPayment)}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 700, color: p.textPrimary }}>
                      {paidCount}
                    </span>{" "}
                    of {schedules.length} paid
                  </>
                )}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: p.watermark,
                  letterSpacing: "0.08em",
                }}
              >
                *utangz
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
