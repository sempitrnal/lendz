import { describe, expect, it } from "vitest";
import {
  changedRoutes,
  routeForUrl,
  urlsToRefresh,
  type OfflineManifest,
} from "./route-diff";

const manifest = (routes: Record<string, string>): OfflineManifest => ({
  buildId: "b",
  routes,
  assets: [],
});

const PATTERNS = ["/", "/borrowers", "/borrowers/[id]", "/borrowers/new"];

describe("routeForUrl", () => {
  it("matches static and dynamic routes", () => {
    expect(routeForUrl("/", PATTERNS)).toBe("/");
    expect(routeForUrl("/borrowers", PATTERNS)).toBe("/borrowers");
    expect(routeForUrl("/borrowers/0a-1b", PATTERNS)).toBe("/borrowers/[id]");
  });

  it("prefers an exact route over a dynamic one", () => {
    expect(routeForUrl("/borrowers/new", PATTERNS)).toBe("/borrowers/new");
  });

  it("ignores query strings and trailing slashes", () => {
    expect(routeForUrl("/borrowers/x/?tab=1", PATTERNS)).toBe(
      "/borrowers/[id]",
    );
  });

  it("returns undefined for unknown paths", () => {
    expect(routeForUrl("/nope/deeper", PATTERNS)).toBeUndefined();
  });
});

describe("changedRoutes", () => {
  it("treats every route as changed without a previous manifest", () => {
    expect(changedRoutes(manifest({ "/": "1", "/a": "2" }), null)).toEqual(
      new Set(["/", "/a"]),
    );
  });

  it("lists routes with a new fingerprint and new routes", () => {
    const prev = manifest({ "/": "1", "/a": "2", "/gone": "3" });
    const next = manifest({ "/": "1", "/a": "9", "/new": "4" });
    expect(changedRoutes(next, prev)).toEqual(new Set(["/a", "/new"]));
  });
});

describe("urlsToRefresh", () => {
  const prev = manifest({
    "/borrowers": "1",
    "/borrowers/[id]": "2",
    "/calendar": "3",
  });
  const next = manifest({
    "/borrowers": "1",
    "/borrowers/[id]": "changed",
    "/calendar": "3",
  });

  it("keeps only pages of changed routes, never data endpoints", () => {
    expect(
      urlsToRefresh(
        [
          "/borrowers",
          "/borrowers/a",
          "/borrowers/b",
          "/calendar",
          "/api/borrowers/a/details",
        ],
        next,
        prev,
      ),
    ).toEqual(["/borrowers/a", "/borrowers/b"]);
  });

  it("refreshes URLs that match no known route, to be safe", () => {
    expect(urlsToRefresh(["/mystery"], next, prev)).toEqual(["/mystery"]);
  });
});
