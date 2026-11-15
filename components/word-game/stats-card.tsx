"use client";

import { m } from "motion/react";
import {
  BookOpen,
  Coins,
  Flame,
  Layers,
  Lightbulb,
  PiggyBank,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { useArcade } from "@/components/word-game/use-arcade";
import { useWordProgress } from "@/components/word-game/use-word-progress";
import { INTEREST_CAP_PER_DAY, INTEREST_RATE } from "@/lib/word-game/arcade";
import { currentStreak, solvedDates } from "@/lib/word-game/streak";

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: string;
  /** Its place in the grid: the cards rise in one after another. */
  index?: number;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
        delay: index * 0.045,
      }}
      className="rounded-2xl bg-muted/50 p-3"
    >
      <span
        className={`flex size-8 items-center justify-center rounded-full
          ${tone}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-2 truncate text-xl font-black tabular-nums">{value}</p>
      <p className="text-[11px] font-bold wg-muted">{label}</p>
    </m.div>
  );
}

/** Lifetime numbers for the word game, from this device. */
export function StatsCard({ date, today }: { date: string; today: string }) {
  const { state } = useArcade();
  const { all } = useWordProgress(date);
  const s = state.stats;
  const streak = currentStreak(solvedDates(all), today);
  const dailySolved = Object.values(all).filter((p) => p.solved).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl wg-card p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          index={0}
          icon={Layers}
          label={`levels solved · on ${state.level}`}
          value={s.levelsSolved}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
        />
        <Stat
          index={1}
          icon={BookOpen}
          label={`words found · ${s.bonusFound} bonus`}
          value={s.wordsFound + s.bonusFound}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
        />
        <Stat
          index={2}
          icon={Sparkles}
          label="longest word"
          value={s.longestWord ? s.longestWord.toLowerCase() : "–"}
          tone="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
        />
        <Stat
          index={3}
          icon={Flame}
          label="best combo"
          value={s.bestCombo}
          tone="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
        />
        <Stat
          index={4}
          icon={Trophy}
          label={`time attack best · ${s.timeAttackPlays} played`}
          value={s.timeAttackBest}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        />
        <Stat
          index={5}
          icon={Coins}
          label={`coins earned · ${state.coins} now`}
          value={s.coinsEarned}
          tone="bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300"
        />
        <Stat
          index={6}
          icon={PiggyBank}
          label="earned in interest"
          value={s.interestEarned}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
        />
        <Stat
          index={7}
          icon={Lightbulb}
          label="hints used"
          value={s.hintsUsed}
          tone="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
        />
        <Stat
          index={8}
          icon={Flame}
          label={`daily streak · ${dailySolved} solved`}
          value={streak}
          tone="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"
        />
      </div>
      <p className="mt-3 px-1 text-[11px] font-semibold wg-muted">
        unspent coins earn {INTEREST_RATE * 100}% interest a day (up to{" "}
        {INTEREST_CAP_PER_DAY} a day). progress is saved on this device.
      </p>
    </div>
  );
}
