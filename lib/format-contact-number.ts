/** Formats digits into `(XXXX) XXX-XXXX` (up to 11 digits). */
export function formatContactNumber(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 4) return `(${digits}`;
  if (digits.length <= 7) {
    return `(${digits.slice(0, 4)}) ${digits.slice(4)}`;
  }
  return `(${digits.slice(0, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
}
