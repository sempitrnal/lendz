import { WordGame } from "@/components/word-game/word-game";
import { manilaToday, resolveDate } from "@/lib/word-game/date";

export default async function WordGamePage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const today = manilaToday();
  const date = resolveDate(params.date, today);
  return <WordGame key={date} date={date} today={today} />;
}
