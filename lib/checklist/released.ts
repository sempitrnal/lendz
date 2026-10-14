import { extractBorrowerMention } from "@/lib/checklist/labels";
import type { AccountFormValues } from "@/lib/validations/account";

export type ParsedReleasedLabel = {
  borrowerId: string;
  borrowerName: string;
  initialValues: Partial<AccountFormValues>;
};

const AMOUNT = /₱?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/;
const CASH_ADVANCE = /\bc\.?\s?a\.?(?=\W|$)|cash\s*advance/i;
const DATE_TOKEN = /\bfor\s+(\d{2})(\d{2})(\d{2})\b/i;

function parseMmddyy(mm: string, dd: string, yy: string): string | null {
  const month = Number(mm);
  const day = Number(dd);
  const year = 2000 + Number(yy);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${mm}-${dd}`;
}

/**
 * Parses a "Released" checklist label such as
 * `[name](/borrowers/<id>) 1,000- c.a. for 103026` into account form values.
 * Returns null when the label has no borrower mention or no amount.
 */
export function parseReleasedLabel(
  label: string,
  checklistDate: string,
): ParsedReleasedLabel | null {
  const mention = extractBorrowerMention(label);
  if (!mention) return null;

  const rest = label.replace(/\[[^\]]+\]\([^)]*\)/g, " ");
  const amountMatch = AMOUNT.exec(rest);
  if (!amountMatch) return null;
  const principal = Number(
    amountMatch[1].replace(/,/g, "") +
      (amountMatch[2] ? `.${amountMatch[2]}` : ""),
  );
  if (!(principal > 0)) return null;

  const initialValues: Partial<AccountFormValues> = {
    borrower_id: mention.id,
    type: CASH_ADVANCE.test(rest) ? "cash_advance" : "loan",
    principal_amount: principal,
    release_date: checklistDate,
  };

  const dateMatch = DATE_TOKEN.exec(rest);
  if (dateMatch) {
    const first = parseMmddyy(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (first && first >= checklistDate) initialValues.first_payment_date = first;
  }

  return {
    borrowerId: mention.id,
    borrowerName: mention.name,
    initialValues,
  };
}
