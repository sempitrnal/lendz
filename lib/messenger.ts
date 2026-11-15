/**
 * A borrower's Messenger username, cleaned from what was typed: an "@", a
 * pasted m.me or facebook.com link, spaces and slashes are dropped, so
 * "@juan.dc", "m.me/juan.dc" and "facebook.com/juan.dc/" all give "juan.dc".
 * Null when nothing usable is left.
 */
export function cleanMessengerUsername(input: string | null | undefined) {
  if (!input) return null;
  let value = input.trim();
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(
    /^(m\.me|(www\.|m\.)?facebook\.com|fb\.com|(www\.)?messenger\.com\/t)\//i,
    "",
  );
  value = value.replace(/^@/, "");
  value = value.split(/[/?#]/)[0] ?? "";
  return /^[a-z0-9.]+$/i.test(value) ? value : null;
}

/** The link that opens a chat with them: the Messenger app on a phone. */
export function messengerLink(username: string) {
  return `https://m.me/${encodeURIComponent(username)}`;
}
