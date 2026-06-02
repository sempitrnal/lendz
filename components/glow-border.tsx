"use client";

import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import { useEffect } from "react";

export function GlowBorder({ duration = 4 }: { duration?: number }) {
  const turn = useMotionValue(0);

  useEffect(() => {
    const ctrl = animate(turn, 1, {
      ease: "linear",
      duration,
      repeat: Infinity,
    });
    return () => ctrl.stop();
  }, [duration, turn]);

  const gradient = useMotionTemplate`conic-gradient(from ${turn}turn, transparent 0%, #bae6fd00 5%, #bae6fd 12%, #ffffff 22%, #bae6fd 32%, #bae6fd00 40%, transparent 44%)`;

  return (
    <>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          boxShadow:
            "0 0 10px 2px rgba(56,189,248,0.7),  0 0 35px 12px rgba(14,165,233,0.18)",
        }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          backgroundImage: gradient,
          WebkitMask:
            "linear-gradient(black, black) content-box, linear-gradient(black, black)",
          WebkitMaskComposite: "destination-out",
          maskComposite: "exclude",
          padding: "2px",
        }}
      />
    </>
  );
}
