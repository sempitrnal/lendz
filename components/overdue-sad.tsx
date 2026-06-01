"use client";

import { useEffect, useState } from "react";

export default function OverdueSad() {
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPopped(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes sadDrop {
          0%   { transform: scale(0) translateY(-8px); opacity: 0; }
          55%  { transform: scale(1.25) translateY(4px); opacity: 1; }
          75%  { transform: scale(0.93) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0px); opacity: 1; }
        }
        @keyframes tearFall {
          0%   { transform: translateY(0) scaleY(0); opacity: 0; transform-origin: top; }
          20%  { opacity: 1; transform: scaleY(1); }
          100% { transform: translateY(10px) scaleY(1); opacity: 0; }
        }
      `}</style>

      <span className="relative ml-2 inline-flex items-center justify-center translate-y-1">
        <svg
          viewBox="0 0 24 24"
          className="relative z-10"
          style={
            popped
              ? { width: "1.75rem", height: "1.75rem", animation: "sadDrop 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }
              : { width: "1.75rem", height: "1.75rem", opacity: 0 }
          }
          aria-hidden
        >
          {/* Face */}
          <circle cx="12" cy="12" r="11" fill="#fca5a5" stroke="#dc2626" strokeWidth="1.5" />
          {/* Left eye */}
          <circle cx="8.5" cy="10" r="1.3" fill="#7f1d1d" />
          {/* Right eye */}
          <circle cx="15.5" cy="10" r="1.3" fill="#7f1d1d" />
          {/* Sad mouth */}
          <path
            d="M8 15.5 Q12 12.5 16 15.5"
            fill="none"
            stroke="#7f1d1d"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Tear left */}
          <ellipse
            cx="8.5" cy="13"
            rx="1" ry="1.5"
            fill="#60a5fa"
            style={
              popped
                ? { animation: "tearFall 1s ease-in 0.4s forwards", opacity: 0 }
                : { opacity: 0 }
            }
          />
          {/* Tear right */}
          <ellipse
            cx="15.5" cy="13"
            rx="1" ry="1.5"
            fill="#60a5fa"
            style={
              popped
                ? { animation: "tearFall 1s ease-in 0.6s forwards", opacity: 0 }
                : { opacity: 0 }
            }
          />
        </svg>
      </span>
    </>
  );
}
