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

/**
 * The Messenger app's own link for a chat. On iPhone, an m.me link opened
 * from the home-screen app (or from a tab it opens) stays in a browser view
 * and never reaches the app, so the app is asked for directly first.
 */
export function messengerAppLink(username: string) {
  return `fb-messenger://user-thread/${encodeURIComponent(username)}`;
}

/** iPhone and iPad (including iPads that report themselves as a Mac). */
export function isIOS(userAgent: string, maxTouchPoints = 0): boolean {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

/**
 * Opens a chat with `username`: on iPhone the Messenger app itself, falling
 * back to m.me in Safari when the app didn't take over (not installed);
 * elsewhere m.me in a new tab.
 */
export function openMessenger(username: string) {
  const web = messengerLink(username);
  if (!isIOS(navigator.userAgent, navigator.maxTouchPoints)) {
    window.open(web, "_blank", "noopener,noreferrer");
    return;
  }
  let left = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.location.href = messengerAppLink(username);
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    // Still here: the app isn't installed. Open the web chat instead.
    if (!left) window.location.href = web;
  }, 1500);
}
