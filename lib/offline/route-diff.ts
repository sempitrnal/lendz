/**
 * Works out which cached pages a new app version actually changed, from the
 * route fingerprints in the build's offline manifest
 * (scripts/offline-manifest.mjs).
 */

export type OfflineManifest = {
  buildId: string;
  /** Route pattern (e.g. `/borrowers/[id]`) → fingerprint of its code. */
  routes: Record<string, string>;
  /** Every static file of the build (`/_next/static/...`). */
  assets: string[];
};

function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "(?:/.*)?";
      if (/^\[\.\.\..+\]$/.test(segment)) return "/.+";
      if (/^\[.+\]$/.test(segment)) return "/[^/]+";
      return segment ? `/${segment.replace(/[.*+?^${}()|\\]/g, "\\$&")}` : "";
    })
    .join("");
  return new RegExp(`^${source || "/"}$`);
}

/**
 * The route pattern a URL belongs to. Exact routes win over dynamic ones
 * (`/borrowers/new` before `/borrowers/[id]`), like the router.
 */
export function routeForUrl(
  url: string,
  patterns: string[],
): string | undefined {
  const path = url.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const dynamicCount = (p: string) => (p.match(/\[/g) ?? []).length;
  const ordered = [...patterns].sort(
    (a, b) => dynamicCount(a) - dynamicCount(b),
  );
  return ordered.find((pattern) => patternToRegExp(pattern).test(path));
}

/** Routes whose code changed since `previous` (all of them without one). */
export function changedRoutes(
  next: OfflineManifest,
  previous: OfflineManifest | null,
): Set<string> {
  const changed = new Set<string>();
  for (const [route, fingerprint] of Object.entries(next.routes)) {
    if (!previous || previous.routes[route] !== fingerprint) changed.add(route);
  }
  return changed;
}

/**
 * The page URLs to download again. Data endpoints (`/api/...`) aren't tied
 * to a route's code and refresh on their own, so they're never included; a
 * URL that matches no known route is, to be safe.
 */
export function urlsToRefresh(
  urls: string[],
  next: OfflineManifest,
  previous: OfflineManifest | null,
): string[] {
  const changed = changedRoutes(next, previous);
  const patterns = Object.keys(next.routes);
  return urls.filter((url) => {
    if (url.startsWith("/api/")) return false;
    const route = routeForUrl(url, patterns);
    return route === undefined || changed.has(route);
  });
}
