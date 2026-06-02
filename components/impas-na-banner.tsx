"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AnimatedNumber from "./animated-number";

export function ImpasNaBanner({ profit }: { profit: number }) {
  const [visible, setVisible] = useState(true);
  const [animatedProfit, setAnimatedProfit] = useState(0);

  useEffect(() => {
    const dismiss = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(dismiss);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setAnimatedProfit(profit), 600);
    return () => clearTimeout(t);
  }, [profit]);

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

    // post-banner burst after dialog fades out
    timers.push(
      setTimeout(() => {
        firework(0.5, 0.3, 120, 50);
        firework(0.2, 0.5, 70, 36);
        firework(0.8, 0.5, 70, 36);
      }, 4600),
    );
    timers.push(
      setTimeout(() => {
        shower(60, 0);
        shower(120, 1);
        firework(0.5, 0.4, 80, 42);
      }, 5000),
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Dialog open={visible} onOpenChange={setVisible}>
      <DialogContent className="data-closed:zoom-out-100! top-0! left-0! flex h-svh max-h-none! w-screen max-w-none! translate-x-0! translate-y-0! flex-col items-center justify-center gap-4 rounded-none border-none bg-green-400 text-center shadow-none duration-500! dark:bg-green-400">
        <DialogTitle asChild>
          {/* <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-[5rem] font-black text-white lg:text-[10rem]"
          >
            impas :)
          </motion.p> */}
        </DialogTitle>
        <DialogDescription asChild>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-[3rem] font-black tracking-tight text-[#3c1961]! lg:text-[3rem]"
          >
            impas! congrats ma {"<3"}
          </motion.p>
        </DialogDescription>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="text-xl font-black text-white/80"
        >
          +₱
          <AnimatedNumber value={animatedProfit} duration={900} /> profit
        </motion.p>
      </DialogContent>
    </Dialog>
  );
}
