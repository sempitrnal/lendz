"use client";

import { useEffect, useMemo, useState } from "react";

export default function PartialPie({ progress }: { progress: number }) {
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPopped(true), 60);
    return () => clearTimeout(t);
  }, []);

  const clamped = Math.max(0, Math.min(100, progress));
  const r = 7;
  const circumference = useMemo(() => 2 * Math.PI * r, []);
  const offset = circumference - (clamped / 100) * circumference;

  const animName = useMemo(() => `fillGrow_${Math.round(clamped)}`, [clamped]);

  return (
    <>
      <style>{`
        @keyframes piePop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          55%  { transform: scale(1.3) rotate(5deg); opacity: 1; }
          75%  { transform: scale(0.93) rotate(-2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes ${animName} {
          0%   { stroke-dashoffset: ${circumference}; }
          100% { stroke-dashoffset: ${offset}; }
        }
      `}</style>

      <span className="relative ml-2 inline-flex items-center justify-center translate-y-1">
        <svg
          viewBox="-1 -1 26 26"
          className="relative z-10"
          style={
            popped
              ? { width: "1.75rem", height: "1.75rem", animation: "piePop 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }
              : { width: "1.75rem", height: "1.75rem", opacity: 0 }
          }
          aria-hidden
        >
          <circle
            cx="12"
            cy="12"
            r="11"
            fill="#ede9fe"
            stroke="#8b5cf6"
            strokeWidth="1.5"
          />
          <circle
            cx="12"
            cy="12"
            r={r}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="11"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            strokeLinecap="butt"
            transform="rotate(-90 12 12)"
            style={
              popped
                ? { animation: `${animName} 0.6s ease-out 0.3s forwards` }
                : { strokeDashoffset: circumference }
            }
          />
          <circle cx="12" cy="12" r="2" fill="#7c3aed" />
        </svg>
      </span>
    </>
  );
}
