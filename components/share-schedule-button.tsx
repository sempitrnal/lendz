"use client";

import { useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
import { Share2 } from "lucide-react";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
    rowBg: "#ffffff",
    badgeBorder: "#d97706",
    badgeBg: "#fef3c7",
    badgeText: "#78350f",
  };
}

const light = {
  pageBg: "#fffefa",
  cardBg: "#ffffff",
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
        className="dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted flex items-center gap-1.5 rounded border-2 border-slate-900 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-slate-50 active:translate-y-px active:shadow-none"
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
              padding: 32,
              fontFamily:
                'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              backgroundColor: p.pageBg,
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: p.textSecondary,
                }}
              >
                {accountType.replace("_", " ")}
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  color: p.textPrimary,
                  marginTop: 4,
                  letterSpacing: "-0.02em",
                }}
              >
                {borrowerName}
              </div>
              {releaseDate ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 6,
                    fontWeight: 600,
                  }}
                >
                  Released {formatDate(releaseDate)}
                </div>
              ) : null}
            </div>

            {!noDetails && (
              <>
                {/* Summary Card */}
                <div
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${p.cardBorder}`,
                    backgroundColor: p.cardBg,
                    padding: 16,
                    boxShadow: `3px 3px 0px 0px ${p.cardShadow}`,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
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
                            fontWeight: 900,
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            color: p.textSecondary,
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 900,
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
                </div>

                {/* Progress Card */}
                <div
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${p.cardBorder}`,
                    backgroundColor: p.cardBg,
                    padding: 16,
                    boxShadow: `3px 3px 0px 0px ${p.cardShadow}`,
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: p.textSecondary,
                        }}
                      >
                        Progress
                      </div>
                      <div
                        style={{
                          fontSize: 36,
                          fontWeight: 900,
                          color: p.textPrimary,
                          marginTop: 2,
                        }}
                      >
                        {progressPct}%
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          color: p.collected,
                        }}
                      >
                        {formatMoney(collected)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: p.textSecondary,
                        }}
                      >
                        of {formatMoney(totalPayment)}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      height: 12,
                      borderRadius: 999,
                      border: `2px solid ${p.cardBorder}`,
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
                </div>
              </>
            )}

            {/* Schedule label */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: p.textSecondary,
                marginBottom: 12,
              }}
            >
              Payment Schedule
            </div>

            {/* Schedule Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {schedules.map((s) => {
                const st = statusPalette(s.status, isDark);
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
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "8px 12px",
                      borderRadius: 8,
                      border: `2px solid ${p.cardBorder}`,
                      padding: "10px 12px",
                      boxShadow: `2px 2px 0px 0px ${p.cardShadow}`,
                      backgroundColor: st.rowBg,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: p.textSecondary,
                      }}
                    >
                      #{s.index}
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: p.textPrimary,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatMoney(s.amount_due)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: p.textMuted,
                      }}
                    >
                      {formatDate(s.due_date)}
                    </span>
                    {s.status === "partial" && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: p.partialPct,
                        }}
                      >
                        {partialPct}%
                      </span>
                    )}
                    {s.status === "paid" && s.paid_date && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: p.paidDate,
                        }}
                      >
                        {formatDate(s.paid_date)}
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: "auto",
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        border: `2px solid ${st.badgeBorder}`,
                        backgroundColor: st.badgeBg,
                        color: st.badgeText,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: `2px dashed ${p.footerBorder}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {!noDetails ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: p.textMuted,
                  }}
                >
                  Total:{" "}
                  <span style={{ fontWeight: 900, color: p.textPrimary }}>
                    {formatMoney(totalPayment)}
                  </span>
                </div>
              ) : (
                <div />
              )}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
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
