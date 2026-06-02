"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";

export function ImpasNaBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const dismiss = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(dismiss);
  }, []);

  useEffect(() => {
    const fw: confetti.Options = {
      ticks: 100,
      gravity: 0.75,
      decay: 0.93,
      zIndex: 9999,
      spread: 360,
      shapes: ["star"],
      colors: [
        "#34d399",
        "#fbbf24",
        "#38bdf8",
        "#c084fc",
        "#f472b6",
        "#ffffff",
      ],
    };

    function firework(x: number, y: number, count: number, v: number) {
      confetti({
        ...fw,
        particleCount: count,
        startVelocity: v,
        origin: { x, y },
      });
    }

    function shower(angle: number, x: number) {
      confetti({
        particleCount: 80,
        angle,
        spread: 65,
        startVelocity: 28,
        ticks: 80,
        zIndex: 9999,
        origin: { x, y: 0.6 },
        shapes: ["square", "circle"],
        colors: ["#34d399", "#fbbf24", "#38bdf8", "#f472b6"],
      });
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // wave 1
    firework(0.5, 0.38, 90, 44);
    // wave 2
    timers.push(
      setTimeout(() => {
        firework(0.2, 0.48, 65, 36);
        firework(0.8, 0.48, 65, 36);
      }, 420),
    );
    // wave 3
    timers.push(
      setTimeout(() => {
        firework(0.35, 0.4, 55, 38);
        firework(0.65, 0.4, 55, 38);
      }, 880),
    );
    // confetti shower
    timers.push(
      setTimeout(() => {
        shower(60, 0);
        shower(120, 1);
      }, 1400),
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ height: "auto" }}
      animate={{ height: visible ? "auto" : 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -12 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="mx-4 mt-2 mb-4 flex flex-col items-center gap-1 rounded-2xl border-2 border-emerald-400 bg-linear-to-br from-emerald-50 to-green-100 px-6 py-5 text-center shadow-[4px_4px_0px_0px_#059669] dark:border-emerald-500 dark:from-emerald-900/30 dark:to-green-900/20 dark:shadow-[4px_4px_0px_0px_#065f46]"
          >
            <motion.p
              initial={{ scale: 0.5 }}
              animate={{ scale: [0.5, 1.25, 1] }}
              transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
              className="text-4xl"
            >
              🎉
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="text-xl font-black tracking-tight text-emerald-800 dark:text-emerald-300"
            >
              Impas na!
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              All payment schedules have been settled.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
