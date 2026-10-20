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
