/**
 * Which saved pages a new deploy re-downloads. A full refresh (`all`) fetches
 * every saved page again; `borrowers` the checklist's and the borrower pages
 * (not the account pages); `checklist` only the checklist's, for a deploy
 * that changed nothing else; `none` no saved page at all (each refreshes when
 * next opened online). The build script writes the scope into
 * `offline-manifest.json` (see scripts/offline-manifest.mjs).
 */

export type RefreshScope = "all" | "borrowers" | "checklist" | "none";

/** The checklist's pages (any query string on them counts). */
export const CHECKLIST_ROUTES = [
  "/daily-checklist",
  "/daily-checklist/v2",
  "/daily-checklist/categories",
];

/** The borrower list and every borrower's page (any query string counts). */
function isBorrowerRoute(path: string) {
  return path === "/borrowers" || path.startsWith("/borrowers/");
}

/** Anything but exactly "checklist", "borrowers" or "none" is a full refresh: the safe default. */
export function parseRefreshScope(value: unknown): RefreshScope {
  return value === "checklist" || value === "borrowers" || value === "none"
    ? value
    : "all";
}

/** The saved pages to fetch again for a new build; API urls are never pages. */
export function urlsToRefresh(urls: string[], scope: RefreshScope): string[] {
  if (scope === "none") return [];
  const pages = urls.filter((url) => !url.startsWith("/api/"));
  if (scope === "all") return pages;
  return pages.filter((url) => {
    const path = url.split("?")[0];
    return (
      CHECKLIST_ROUTES.includes(path) ||
      (scope === "borrowers" && isBorrowerRoute(path))
    );
  });
}
