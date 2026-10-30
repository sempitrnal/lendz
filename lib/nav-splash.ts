/** Pure logic behind the navigation splash (`components/nav-splash.tsx`). */

type ClickLike = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

type AnchorLike = {
  href: string;
  target: string | null;
  hasDownload: boolean;
};

/**
 * The pathname a click is taking the app to, or null when it is not a plain
 * in-app navigation (a new tab, a download, another site, the same page).
 */
export function navTarget(
  anchor: AnchorLike,
  click: ClickLike,
  origin: string,
  currentPath: string,
): string | null {
  if (click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) {
    return null;
  }
  if (anchor.hasDownload) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  let url: URL;
  try {
    // Relative to the page it sits on, as the browser reads it.
    url = new URL(anchor.href, origin + currentPath);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  // Only the path counts: a query or hash change keeps the page (the
  // checklist's day and tab live in the query).
  return url.pathname === currentPath ? null : url.pathname;
}

/** What the splash says it is opening. */
export function splashLabel(pathname: string): string {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/daily-checklist") return "checklist";
  if (pathname === "/releases") return "release plan";
  if (pathname === "/borrowers") return "borrowers";
  if (pathname.startsWith("/borrowers/")) return "borrower";
  if (pathname.startsWith("/accounts/")) return "account";
  if (pathname === "/upcoming") return "upcoming";
  return "page";
}

/** The event a programmatic navigation (a tab calling `router.push`) sends. */
export const NAV_SPLASH_EVENT = "nav-splash";

/**
 * Tells the splash the app is about to go to `to`. Call it just before
 * `router.push`, while the current page's band is still on screen. Links
 * need no call: the splash sees their taps itself.
 */
export function announceNavigation(to: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string>(NAV_SPLASH_EVENT, { detail: to }),
  );
}
