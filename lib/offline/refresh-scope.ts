/**
 * Which saved pages a new deploy re-downloads. A full refresh (`all`) fetches
 * every saved page again; `checklist` fetches only the checklist's, for a
 * deploy that changed nothing else. The build script writes the scope into
 * `offline-manifest.json` (see scripts/offline-manifest.mjs).
 */

export type RefreshScope = "all" | "checklist";

/** The checklist's pages (any query string on them counts). */
export const CHECKLIST_ROUTES = [
  "/daily-checklist",
  "/daily-checklist/v2",
  "/daily-checklist/categories",
];

/** Anything but exactly "checklist" is a full refresh: the safe default. */
export function parseRefreshScope(value: unknown): RefreshScope {
  return value === "checklist" ? "checklist" : "all";
}

/** The saved pages to fetch again for a new build; API urls are never pages. */
export function urlsToRefresh(urls: string[], scope: RefreshScope): string[] {
  const pages = urls.filter((url) => !url.startsWith("/api/"));
  if (scope === "all") return pages;
  return pages.filter((url) => CHECKLIST_ROUTES.includes(url.split("?")[0]));
}
