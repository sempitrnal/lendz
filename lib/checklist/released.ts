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
/**
 * New loan amount on a renewal, e.g. "renew for 15k" or "renew for 15,000".
 * The first amount on such a label is the net cash released (new principal
 * minus the old account's balance), so this one is the principal instead.
 */
const RENEW_AMOUNT =
  /\brenew\s+for\s+₱?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b(?!\s*(?:months?|mos?)\b)/i;
/** e.g. "(8) months", "12 MONTHS TO PAY", "6mos", "3 mo." */
const TERM_TOKEN = /\(?\s*(\d+(?:\.\d+)?)\s*\)?\s*(?:months?|mos?)\b/i;

/** e.g. "(2) gives", "3 gives", "1 give" */
const GIVES_TOKEN = /\(?\s*(\d+)\s*\)?\s*gives?\b/i;
/** e.g. "11/15" or "11/15/26" */
const SLASH_DATE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/g;

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
 * Pulls every M/D(/YY) date out of a label. A missing year resolves to the
 * first occurrence on or after the checklist date.
 */
function parseSlashDates(rest: string, checklistDate: string): string[] {
  const baseYear = Number(checklistDate.slice(0, 4));
  const dates: string[] = [];
  for (const m of rest.matchAll(SLASH_DATE)) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    let iso: string | null;
    if (m[3]) {
      const yy = m[3].slice(-2);
      iso = parseMmddyy(mm, dd, yy);
    } else {
      iso = parseMmddyy(mm, dd, String(baseYear).slice(-2));
      if (iso && iso < checklistDate) {
        iso = parseMmddyy(mm, dd, String(baseYear + 1).slice(-2));
      }
    }
    if (iso && !dates.includes(iso)) dates.push(iso);
  }
  return dates.sort();
}

/**
 * Parses a "Released" checklist label such as
 * `[name](/borrowers/<id>) 1,000- c.a. for 103026` or
 * `[name](/borrowers/<id>) 70,000 - renew for (12) MONTHS TO PAY` into
 * account form values.
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
  let principal = Number(
    amountMatch[1].replace(/,/g, "") +
      (amountMatch[2] ? `.${amountMatch[2]}` : ""),
  );
  const renewMatch = RENEW_AMOUNT.exec(rest);
  if (renewMatch) {
    const renewed =
      Number(renewMatch[1].replace(/,/g, "")) * (renewMatch[2] ? 1000 : 1);
    if (renewed > 0) principal = renewed;
  }
  if (!(principal > 0)) return null;

  const initialValues: Partial<AccountFormValues> = {
    borrower_id: mention.id,
    type: CASH_ADVANCE.test(rest) ? "cash_advance" : "loan",
    principal_amount: principal,
    release_date: checklistDate,
  };

  const termMatch = TERM_TOKEN.exec(rest);
  if (termMatch) {
    const term = Number(termMatch[1]);
    if (term > 0) initialValues.term_months = term;
  }

  const dateMatch = DATE_TOKEN.exec(rest);
  if (dateMatch) {
    const first = parseMmddyy(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (first && first >= checklistDate)
      initialValues.first_payment_date = first;
  }

  const givesMatch = GIVES_TOKEN.exec(rest);
  const gives = givesMatch ? Number(givesMatch[1]) : 0;
  if (gives > 0) {
    // "(2) gives for 11/15 & 11/30": custom frequency, term = number of gives.
    initialValues.payment_frequency = "custom";
    initialValues.term_months = gives;
    const [firstGive] = parseSlashDates(rest, checklistDate);
    if (firstGive) initialValues.first_payment_date = firstGive;
  }

  return {
    borrowerId: mention.id,
    borrowerName: mention.name,
    initialValues,
  };
}
