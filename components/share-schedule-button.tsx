"use client";

import { useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";
import { Download, Share2 } from "lucide-react";

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

function statusColor(status: string) {
  if (status === "paid") return { bg: "#d1fae5", border: "#059669", text: "#064e3b" };
  if (status === "partial") return { bg: "#ede9fe", border: "#7c3aed", text: "#2e1065" };
  if (status === "overdue") return { bg: "#ffe4e6", border: "#e11d48", text: "#881337" };
  return { bg: "#fef3c7", border: "#d97706", text: "#78350f" };
}

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

  const capture = useCallback(async () => {
    setShowCard(true);
    setRendering(true);

    // Wait for the hidden card to render
    await new Promise((r) => setTimeout(r, 100));

    if (!cardRef.current) {
      setRendering(false);
      setShowCard(false);
      return;
    }

    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#fffefa",
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
          { type: "image/png" }
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
        className="flex items-center gap-2 rounded-lg border-2 border-slate-900 bg-violet-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition cursor-pointer hover:bg-violet-300 active:translate-y-0 active:shadow-[1px_1px_0px_0px_#0f172a] disabled:cursor-wait disabled:opacity-70"
      >
        {rendering ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <Share2 className="size-3.5" />
        )}
        {rendering ? "Generating…" : noDetails ? "Share (no details)" : "Share"}
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
              backgroundColor: "#fffefa",
            }}
          >
            {/* Header */}
            <div
              style={{
                borderRadius: 16,
                border: "3px solid #0f172a",
                overflow: "hidden",
                boxShadow: "6px 6px 0px 0px #0f172a",
              }}
            >
              {/* Title bar */}
              <div
                style={{
                  background: "#ffffec",
                  borderBottom: "3px solid #0f172a",
                  padding: "20px 24px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "#334155",
                  }}
                >
                  {accountType.replace("_", " ")}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: "#0f172a",
                    marginTop: 4,
                  }}
                >
                  {borrowerName}
                </div>
                {releaseDate ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#475569",
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
                  {/* Balances grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr",
                      borderBottom: "3px solid #0f172a",
                    }}
                  >
                    {[
                      { label: "Principal", value: principal, bg: "#e0f2fe" },
                      { label: "Collected", value: collected, bg: "#d1fae5" },
                      { label: "Remaining", value: remaining, bg: "#ffe4e6" },
                      { label: "Profit", value: Math.max(0, profit), bg: "#fef3c7" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "14px 16px",
                          backgroundColor: item.bg,
                          borderRight:
                            i < 3 ? "3px solid #0f172a" : "none",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            color: "#64748b",
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 900,
                            color: "#0f172a",
                            marginTop: 4,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatMoney(item.value)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                </>
              )}

              {!noDetails && (
              <div
                style={{
                  padding: "12px 24px",
                  borderBottom: "3px solid #0f172a",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  <span>Progress</span>
                  <span>{progressPct}%</span>
                </div>
                <div
                  style={{
                    height: 12,
                    borderRadius: 6,
                    border: "2px solid #0f172a",
                    backgroundColor: "white",
                    overflow: "hidden",
                    boxShadow: "2px 2px 0px 0px #0f172a",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      backgroundColor: "#34d399",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
              )}

              {/* Schedule table */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    {["#", "Due Date", "Due", "Paid", "Left", "Status", "Paid Date"].map(
                      (h, i) => (
                        <th
                          key={i}
                          style={{
                            borderBottom: "3px solid #0f172a",
                            borderRight:
                              i < 6 ? "2px solid #0f172a" : "none",
                            backgroundColor: "#e2e8f0",
                            padding: "10px 12px",
                            textAlign: i >= 2 && i <= 4 ? "right" : "left",
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            color: "#0f172a",
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => {
                    const sc = statusColor(s.status);
                    return (
                      <tr key={s.index}>
                        {[
                          {
                            content: String(s.index),
                            align: "left" as const,
                          },
                          {
                            content: formatDate(s.due_date),
                            align: "left" as const,
                          },
                          {
                            content: formatMoney(s.amount_due),
                            align: "right" as const,
                          },
                          {
                            content: formatMoney(s.amount_paid),
                            align: "right" as const,
                          },
                          {
                            content: formatMoney(s.remaining),
                            align: "right" as const,
                          },
                        ].map((cell, ci) => (
                          <td
                            key={ci}
                            style={{
                              borderBottom: "2px solid #0f172a",
                              borderRight: "2px solid #0f172a",
                              padding: "10px 12px",
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                              color: "#0f172a",
                              textAlign: cell.align,
                              backgroundColor:
                                s.status === "paid"
                                  ? "#ecfdf5"
                                  : s.status === "overdue"
                                    ? "#fff1f2"
                                    : s.status === "partial"
                                      ? "#f5f3ff"
                                      : "#fffbeb",
                            }}
                          >
                            {cell.content}
                          </td>
                        ))}
                        {/* Status badge */}
                        <td
                          style={{
                            borderBottom: "2px solid #0f172a",
                            borderRight: "2px solid #0f172a",
                            padding: "10px 12px",
                            backgroundColor:
                              s.status === "paid"
                                ? "#ecfdf5"
                                : s.status === "overdue"
                                  ? "#fff1f2"
                                  : s.status === "partial"
                                    ? "#f5f3ff"
                                    : "#fffbeb",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 999,
                              border: `2px solid ${sc.border}`,
                              backgroundColor: sc.bg,
                              color: sc.text,
                              fontSize: 10,
                              fontWeight: 900,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              boxShadow: "2px 2px 0px 0px #0f172a",
                            }}
                          >
                            {s.status}
                          </span>
                        </td>
                        {/* Paid date */}
                        <td
                          style={{
                            borderBottom: "2px solid #0f172a",
                            padding: "10px 12px",
                            fontWeight: 600,
                            color: "#475569",
                            backgroundColor:
                              s.status === "paid"
                                ? "#ecfdf5"
                                : s.status === "overdue"
                                  ? "#fff1f2"
                                  : s.status === "partial"
                                    ? "#f5f3ff"
                                    : "#fffbeb",
                          }}
                        >
                          {s.paid_date ? formatDate(s.paid_date) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer */}
              <div
                style={{
                  padding: "14px 24px",
                  backgroundColor: "#f1f5f9",
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
                      color: "#475569",
                    }}
                  >
                    Total :{" "}
                    <span style={{ fontWeight: 900, color: "#0f172a" }}>
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
                    color: "#94a3b8",
                    letterSpacing: "0.08em",
                  }}
                >
                  *utangz
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
