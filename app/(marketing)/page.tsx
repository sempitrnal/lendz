"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Wallet,
  ShieldCheck,
  Zap,
  ArrowRight,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut" as const,
    },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 18,
    },
  },
};

function Breakout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative ml-[calc(50%-50dvw)] w-dvw max-w-dvw ${className}`}
    >
      {children}
    </div>
  );
}

function NeobrutCard({
  children,
  className,
  color = "white",
}: {
  children: React.ReactNode;
  className?: string;
  color?: "white" | "sky" | "green" | "yellow";
}) {
  const bg =
    color === "sky"
      ? "bg-sky-200 dark:bg-sky-900/30"
      : color === "green"
        ? "bg-green-300 dark:bg-green-900/30"
        : color === "yellow"
          ? "bg-yellow-300 dark:bg-yellow-900/30"
          : "bg-white dark:bg-card";
  return (
    <div
      className={`rounded-xl border-2 border-slate-900 p-6 shadow-[6px_6px_0px_0px_#0f172a] transition-transform hover:-translate-y-0.5 dark:border-zinc-700 dark:shadow-[6px_6px_0px_0px_#18181b] ${bg} ${className}`}
    >
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-12 overflow-x-clip">
      {/* ── HERO ── */}
      <Breakout className="relative bg-sky-200 dark:bg-sky-950/40">
        {/* subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #0f172a 0, #0f172a 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, #0f172a 0, #0f172a 1px, transparent 1px, transparent 32px)",
          }}
        />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center sm:py-28 md:px-6"
        >
          {/* stacked logo */}
          <motion.div variants={staggerItem} className="relative select-none">
            <span className="block text-7xl leading-none font-black tracking-tighter text-slate-900 sm:text-8xl md:text-9xl dark:text-zinc-100">
              *utangz
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1.25 left-1.25 block text-7xl leading-none font-black tracking-tighter text-white sm:top-1.75 sm:left-1.75 sm:text-8xl md:top-2.25 md:left-2.25 md:text-9xl dark:text-zinc-800"
              style={{ zIndex: -1 }}
            >
              *utangz
            </span>
          </motion.div>

          <motion.p
            variants={staggerItem}
            className="mt-6 max-w-xl text-lg leading-relaxed font-bold text-slate-700 sm:text-xl dark:text-zinc-300"
          >
            A no-nonsense lending &amp; borrowing tracker built for people who
            want to stay on top of every payment.
          </motion.p>

          <motion.div
            variants={staggerItem}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Link
              href="/login"
              className="dark:bg-card inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-7 py-3.5 text-sm font-black tracking-wide text-slate-900 uppercase shadow-[5px_5px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#0f172a] active:translate-y-px active:shadow-none dark:border-zinc-700 dark:text-zinc-100 dark:shadow-[5px_5px_0px_0px_#18181b]"
            >
              Get Started
              <ArrowRight className="size-4" strokeWidth={3} />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-slate-900 px-7 py-3.5 text-sm font-black tracking-wide text-white uppercase shadow-[5px_5px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[3px_3px_0px_0px_#0f172a] active:translate-y-px active:shadow-none dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-[5px_5px_0px_0px_#18181b]"
            >
              <LayoutDashboard className="size-4" strokeWidth={3} />
              Dashboard
            </Link>
          </motion.div>
        </motion.div>
      </Breakout>

      {/* ── FEATURES ── */}
      <Breakout className="dark:bg-background bg-white">
        <section className="w-full py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-center text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase dark:text-zinc-500"
            >
              Features
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-3 text-center text-3xl font-black tracking-tight text-slate-900 uppercase sm:text-5xl dark:text-zinc-100"
            >
              Everything you need to track loans
            </motion.h2>

            <motion.div
              variants={staggerContainer}
              className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {[
                {
                  color: "sky" as const,
                  Icon: Users,
                  title: "Borrowers",
                  body: "Keep profiles, contact info, and notes on every person you lend to.",
                },
                {
                  color: "green" as const,
                  Icon: Wallet,
                  title: "Accounts",
                  body: "Track principal, interest rates, terms, and activation dates per loan.",
                },
                {
                  color: "yellow" as const,
                  Icon: CalendarDays,
                  title: "Schedules",
                  body: "Auto-generate weekly, monthly, or custom payment schedules with due dates.",
                },
                {
                  color: "white" as const,
                  Icon: ShieldCheck,
                  title: "Collections",
                  body: "Record partial or full payments and watch balances update in real time.",
                },
              ].map(({ color, Icon, title, body }) => (
                <motion.div key={title} variants={staggerItem}>
                  <NeobrutCard color={color}>
                    <div className="dark:bg-card mb-3 inline-flex rounded-lg border-2 border-slate-900 bg-white p-2.5 shadow-[3px_3px_0px_0px_#0f172a] dark:border-zinc-700 dark:shadow-[3px_3px_0px_0px_#18181b]">
                      <Icon
                        className="size-6 text-slate-900 dark:text-zinc-100"
                        strokeWidth={2.5}
                      />
                    </div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed font-semibold text-slate-600 dark:text-zinc-400">
                      {body}
                    </p>
                  </NeobrutCard>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>
      </Breakout>

      {/* ── MARQUEE STRIP ── */}
      <Breakout className="overflow-hidden border-y-2 border-slate-900 bg-green-300 py-3 dark:border-zinc-700 dark:bg-green-900/40">
        <div className="animate-marquee flex gap-8 whitespace-nowrap">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-2 text-sm font-black tracking-widest text-slate-900 uppercase dark:text-zinc-100"
            >
              <Zap className="size-4" strokeWidth={2.5} />
              Fast · Simple · Reliable · No ads · No bloat
            </span>
          ))}
        </div>
      </Breakout>

      {/* ── HOW IT WORKS ── */}
      <Breakout className="bg-amber-50 dark:bg-zinc-950/50">
        <section className="w-full py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-center text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase dark:text-zinc-500"
            >
              How it works
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-3 text-center text-3xl font-black tracking-tight text-slate-900 uppercase sm:text-5xl dark:text-zinc-100"
            >
              Three steps to stay in control
            </motion.h2>

            <motion.div
              variants={staggerContainer}
              className="mt-12 grid gap-6 sm:grid-cols-3"
            >
              {[
                {
                  step: "01",
                  title: "Add a borrower",
                  body: "Create a profile with name, contact number, and optional notes.",
                  color: "sky" as const,
                },
                {
                  step: "02",
                  title: "Create an account",
                  body: "Set principal, interest, term, and payment frequency. Activation is one click away.",
                  color: "yellow" as const,
                },
                {
                  step: "03",
                  title: "Track & collect",
                  body: "View schedules, record payments, and monitor collection rates on your dashboard.",
                  color: "green" as const,
                },
              ].map(({ step, title, body, color }) => (
                <motion.div key={step} variants={staggerItem}>
                  <NeobrutCard color={color} className="relative">
                    <span className="absolute -top-3 -right-2 text-5xl font-black text-slate-900/10 dark:text-zinc-100/10">
                      {step}
                    </span>
                    <span className="relative z-10 text-3xl font-black text-slate-300 dark:text-zinc-600">
                      {step}
                    </span>
                    <h3 className="relative z-10 mt-2 text-xl font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
                      {title}
                    </h3>
                    <p className="relative z-10 mt-2 text-sm leading-relaxed font-semibold text-slate-600 dark:text-zinc-400">
                      {body}
                    </p>
                  </NeobrutCard>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>
      </Breakout>

      {/* ── FOOTER CTA ── */}
      <Breakout className="relative bg-slate-900 py-20 dark:bg-zinc-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 24px)",
          }}
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerContainer}
          className="relative mx-auto max-w-7xl px-4 text-center md:px-6"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-black tracking-tight text-white uppercase sm:text-5xl"
          >
            Ready to stop guessing?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="mx-auto mt-4 max-w-lg text-base leading-relaxed font-semibold text-slate-400"
          >
            Sign in and start tracking your loans with the clarity they deserve.
          </motion.p>
          <motion.div
            variants={fadeUp}
            custom={2}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-white bg-white px-8 py-3.5 text-sm font-black tracking-wide text-slate-900 uppercase shadow-[5px_5px_0px_0px_#64748b] transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#64748b] active:translate-y-px active:shadow-none"
            >
              Start Tracking
              <ArrowRight className="size-4" strokeWidth={3} />
            </Link>
          </motion.div>
          <motion.p
            variants={fadeUp}
            custom={3}
            className="mt-8 text-[10px] font-black tracking-widest text-slate-600"
          >
            *utangz
          </motion.p>
        </motion.div>
      </Breakout>
    </div>
  );
}
