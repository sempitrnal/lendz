import { WordGame, type GameMode } from "@/components/word-game/word-game";
import { manilaToday, resolveDate } from "@/lib/word-game/date";

export default async function WordGamePage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; mode?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const today = manilaToday();
  const date = resolveDate(params.date, today);
  // A date in the address is the daily puzzle; otherwise the chosen mode, or
  // the levels.
  const modes: GameMode[] = ["levels", "daily", "time", "stats"];
  const mode: GameMode = modes.includes(params.mode as GameMode)
    ? (params.mode as GameMode)
    : params.date
      ? "daily"
      : "levels";
  return <WordGame key={date} date={date} today={today} mode={mode} />;
}
