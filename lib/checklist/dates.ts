export function todayDateValue() {
  return new Date().toLocaleDateString("en-CA");
}

export function overdueCutoffDateValue() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}

function parseDateValue(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string) {
  const ms = parseDateValue(to).getTime() - parseDateValue(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function shiftDateValue(value: string, days: number) {
  const d = parseDateValue(value);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export function relativeDayLabel(
  value: string,
  today = todayDateValue(),
): string | null {
  const diff = daysBetween(today, value);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff === 1) return "tomorrow";
  return null;
}

/** e.g. "tuesday, oct 14" — adds the year when it isn't the current one. */
export function formatLongDate(value: string, today = todayDateValue()) {
  const d = parseDateValue(value);
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    })
    .toLowerCase();
}
