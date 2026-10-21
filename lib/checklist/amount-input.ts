/**
 * Reads a typed peso amount. Accepts plain numbers ("1500", "1500.5",
 * ".5") and thousands commas in the usual places ("1,500", "12,345.67"),
 * with an optional leading "₱" and surrounding spaces. Anything else
 * (empty, negative, "1,5", "1.500,00", letters) is null, so a misplaced comma
 * is never read as a smaller amount the way `parseFloat("1,500")` reads 1.
 */
export function parseAmountInput(raw: string): number | null {
  const text = raw.trim().replace(/^₱\s*/, "");
  if (text === "") return null;
  let digits: string;
  if (/^(\d+(\.\d*)?|\.\d+)$/.test(text)) digits = text;
  else if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(text)) {
    digits = text.replace(/,/g, "");
  } else return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** Rounds to centavos. */
export const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Formats a typed amount with thousands commas as it is typed: "1500" →
 * "1,500", "1234567.8" → "1,234,567.8". Keeps a trailing "." and at most two
 * decimals, drops anything that isn't a digit or the first ".", and never adds
 * a "₱". Round-trips through `parseAmountInput`.
 */
export function formatAmountInput(raw: string): string {
  const text = raw.replace(/[^\d.]/g, "");
  const dot = text.indexOf(".");
  const whole = (dot === -1 ? text : text.slice(0, dot)).replace(
    /^0+(?=\d)/,
    "",
  );
  const fraction =
    dot === -1
      ? null
      : text
          .slice(dot + 1)
          .replace(/\./g, "")
          .slice(0, 2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fraction === null) return grouped;
  return `${grouped === "" ? "0" : grouped}.${fraction}`;
}

/** How many digits and dots sit before `index` — a caret position that
 * survives the commas being added or removed. */
export function significantBefore(text: string, index: number): number {
  return text.slice(0, index).replace(/[^\d.]/g, "").length;
}

/** The index in `text` that has `count` digits and dots before it. */
export function indexAfterSignificant(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/[\d.]/.test(text[i])) seen += 1;
    if (seen === count) return i + 1;
  }
  return text.length;
}
