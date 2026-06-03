import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Wallet,
  ShieldCheck,
  Zap,
  ArrowRight,
} from "lucide-react";

function Breakout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative right-1/2 left-1/2 -mx-[50vw] w-screen ${className}`}
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
    <div className="flex flex-col">
      {/* ── HERO ── */}
      <Breakout className="bg-sky-200 dark:bg-sky-950/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center sm:py-28 md:px-6">
          {/* stacked logo */}
          <div className="relative select-none">
            <span className="block text-6xl leading-none font-black tracking-tighter text-slate-900 sm:text-8xl md:text-9xl dark:text-zinc-100">
              *utangz
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute top-[5px] left-[5px] block text-6xl leading-none font-black tracking-tighter text-white sm:top-[7px] sm:left-[7px] sm:text-8xl md:top-[9px] md:left-[9px] md:text-9xl dark:text-zinc-800"
              style={{ zIndex: -1 }}
            >
              *utangz
            </span>
          </div>

          <p className="mt-6 max-w-lg text-lg font-bold text-slate-700 sm:text-xl dark:text-zinc-300">
            A no-nonsense lending & borrowing tracker built for people who want
            to stay on top of every payment.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="dark:bg-card inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-6 py-3 text-sm font-black tracking-wide text-slate-900 uppercase shadow-[4px_4px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#0f172a] active:translate-y-px active:shadow-none dark:border-zinc-700 dark:text-zinc-100 dark:shadow-[4px_4px_0px_0px_#18181b]"
            >
              Get Started
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-slate-900 px-6 py-3 text-sm font-black tracking-wide text-white uppercase shadow-[4px_4px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[3px_3px_0px_0px_#0f172a] active:translate-y-px active:shadow-none dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-[4px_4px_0px_0px_#18181b]"
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </Breakout>

      {/* ── FEATURES ── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
        <p className="text-center text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-500">
          Features
        </p>
        <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-slate-900 uppercase sm:text-4xl dark:text-zinc-100">
          Everything you need to track loans
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <NeobrutCard color="sky">
            <Users
              className="size-8 text-slate-900 dark:text-zinc-100"
              strokeWidth={2}
            />
            <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
              Borrowers
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-zinc-400">
              Keep profiles, contact info, and notes on every person you lend
              to.
            </p>
          </NeobrutCard>

          <NeobrutCard color="green">
            <Wallet
              className="size-8 text-slate-900 dark:text-zinc-100"
              strokeWidth={2}
            />
            <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
              Accounts
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-zinc-400">
              Track principal, interest rates, terms, and activation dates per
              loan.
            </p>
          </NeobrutCard>

          <NeobrutCard color="yellow">
            <CalendarDays
              className="size-8 text-slate-900 dark:text-zinc-100"
              strokeWidth={2}
            />
            <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
              Schedules
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-zinc-400">
              Auto-generate weekly, monthly, or custom payment schedules with
              due dates.
            </p>
          </NeobrutCard>

          <NeobrutCard>
            <ShieldCheck
              className="size-8 text-slate-900 dark:text-zinc-100"
              strokeWidth={2}
            />
            <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
              Collections
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-zinc-400">
              Record partial or full payments and watch balances update in real
              time.
            </p>
          </NeobrutCard>
        </div>
      </section>

      {/* ── MARQUEE STRIP ── */}
      <Breakout className="overflow-hidden border-y-2 border-slate-900 bg-green-300 py-3 dark:border-zinc-700 dark:bg-green-900/40">
        <div className="animate-marquee flex gap-8 whitespace-nowrap">
          {Array.from({ length: 8 }).map((_, i) => (
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
      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
        <p className="text-center text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-500">
          How it works
        </p>
        <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-slate-900 uppercase sm:text-4xl dark:text-zinc-100">
          Three steps to stay in control
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Add a borrower",
              body: "Create a profile with name, contact number, and optional notes.",
              color: "sky",
            },
            {
              step: "02",
              title: "Create an account",
              body: "Set principal, interest, term, and payment frequency. Activation is one click away.",
              color: "yellow",
            },
            {
              step: "03",
              title: "Track & collect",
              body: "View schedules, record payments, and monitor collection rates on your dashboard.",
              color: "green",
            },
          ].map(({ step, title, body, color }) => (
            <NeobrutCard key={step} color={color as any}>
              <span className="text-3xl font-black text-slate-300 dark:text-zinc-600">
                {step}
              </span>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
                {title}
              </h3>
              <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-zinc-400">
                {body}
              </p>
            </NeobrutCard>
          ))}
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <Breakout className="bg-slate-900 py-16 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-black tracking-tight text-white uppercase sm:text-4xl">
            Ready to stop guessing?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base font-semibold text-slate-400">
            Sign in and start tracking your loans with the clarity they deserve.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-white bg-white px-8 py-3 text-sm font-black tracking-wide text-slate-900 uppercase shadow-[4px_4px_0px_0px_#64748b] transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#64748b] active:translate-y-px active:shadow-none"
            >
              Start Tracking
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-8 text-[10px] font-black tracking-widest text-slate-600">
            *utangz
          </p>
        </div>
      </Breakout>
    </div>
  );
}
