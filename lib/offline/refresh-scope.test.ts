import { describe, expect, it } from "vitest";
import {
  CHECKLIST_ROUTES,
  parseRefreshScope,
  urlsToRefresh,
} from "@/lib/offline/refresh-scope";

const urls = [
  "/offline",
  "/dashboard",
  "/daily-checklist",
  "/daily-checklist/v2",
  "/daily-checklist/categories",
  "/api/borrowers",
  "/borrowers/abc",
  "/borrowers/abc?tab=notes",
  "/accounts/xyz",
  "/api/borrowers/abc/details",
];

describe("parseRefreshScope", () => {
  it("is 'checklist' only for that exact value, else 'all'", () => {
    expect(parseRefreshScope("checklist")).toBe("checklist");
    expect(parseRefreshScope("all")).toBe("all");
    expect(parseRefreshScope(undefined)).toBe("all");
    expect(parseRefreshScope("Checklist ")).toBe("all");
    expect(parseRefreshScope(7)).toBe("all");
  });
});

describe("urlsToRefresh", () => {
  it("'all' refreshes every page, never the API urls", () => {
    expect(urlsToRefresh(urls, "all")).toEqual([
      "/offline",
      "/dashboard",
      "/daily-checklist",
      "/daily-checklist/v2",
      "/daily-checklist/categories",
      "/borrowers/abc",
      "/borrowers/abc?tab=notes",
      "/accounts/xyz",
    ]);
  });
  it("'checklist' refreshes only the checklist pages", () => {
    expect(urlsToRefresh(urls, "checklist")).toEqual([
      "/daily-checklist",
      "/daily-checklist/v2",
      "/daily-checklist/categories",
    ]);
  });
  it("matches the checklist routes whole, not by prefix or with a query", () => {
    expect(
      urlsToRefresh(
        ["/daily-checklist-old", "/daily-checklist?date=2026-10-21"],
        "checklist",
      ),
    ).toEqual(["/daily-checklist?date=2026-10-21"]);
  });
  it("lists the checklist routes", () => {
    expect(CHECKLIST_ROUTES).toEqual([
      "/daily-checklist",
      "/daily-checklist/v2",
      "/daily-checklist/categories",
    ]);
  });
});
