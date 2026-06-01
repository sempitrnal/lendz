"use client";

import { useEffect, useState } from "react";

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

export default function PaidCheck() {
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPopped(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes checkPop {
          0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
          55%  { transform: scale(1.35) rotate(8deg); opacity: 1; }
          75%  { transform: scale(0.92) rotate(-3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes rayShoot {
          0%   { stroke-dashoffset: 12; opacity: 1; }
          60%  { stroke-dashoffset: 0;  opacity: 1; }
          100% { stroke-dashoffset: 0;  opacity: 0; }
        }
      `}</style>

      <span className="relative ml-2 inline-flex items-center justify-center translate-y-1">
        {/* Radiating rays */}
        <svg
          viewBox="0 0 48 48"
          className="pointer-events-none absolute"
          style={{ width: "3rem", height: "3rem" }}
          aria-hidden
        >
          {RAYS.map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const cx = 24, cy = 24, r1 = 16, r2 = 22;
            const x1 = cx + r1 * Math.cos(rad);
            const y1 = cy + r1 * Math.sin(rad);
            const x2 = cx + r2 * Math.cos(rad);
            const y2 = cy + r2 * Math.sin(rad);
            return (
              <line
                key={deg}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="12"
                strokeDashoffset="12"
                style={
                  popped
                    ? { animation: `rayShoot 0.7s ease-out ${i * 0.04}s forwards` }
                    : { opacity: 0 }
                }
              />
            );
          })}
        </svg>

        {/* Checkmark circle */}
        <svg
          viewBox="0 0 24 24"
          className="relative z-10"
          style={
            popped
              ? { width: "1.75rem", height: "1.75rem", animation: "checkPop 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }
              : { width: "1.75rem", height: "1.75rem", opacity: 0 }
          }
          aria-hidden
        >
          <circle cx="12" cy="12" r="11" fill="#22c55e" stroke="#15803d" strokeWidth="1.5" />
          <polyline
            points="6.5,12.5 10.5,16.5 17.5,8.5"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </>
  );
}
