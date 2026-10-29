import { describe, expect, it } from "vitest";
import { navTarget, splashLabel } from "@/lib/nav-splash";

const origin = "https://app.test";
const plain = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};
const link = (
  href: string,
  extra: Partial<Parameters<typeof navTarget>[0]> = {},
) => ({
  href,
  target: null,
  hasDownload: false,
  ...extra,
});

describe("navTarget", () => {
  it("returns the path of a plain in-app click", () => {
    expect(navTarget(link("/borrowers"), plain, origin, "/dashboard")).toBe(
      "/borrowers",
    );
    expect(
      navTarget(
        link("https://app.test/daily-checklist?tab=release"),
        plain,
        origin,
        "/dashboard",
      ),
    ).toBe("/daily-checklist");
  });

  it("ignores the page already open, even with a new query or hash", () => {
    expect(
      navTarget(
        link("/daily-checklist?date=2026-10-29"),
        plain,
        origin,
        "/daily-checklist",
      ),
    ).toBeNull();
    expect(navTarget(link("#top"), plain, origin, "/dashboard")).toBeNull();
  });

  it("ignores new-tab, download, modified and non-primary clicks", () => {
    expect(
      navTarget(
        link("/borrowers", { target: "_blank" }),
        plain,
        origin,
        "/dashboard",
      ),
    ).toBeNull();
    expect(
      navTarget(
        link("/borrowers", { hasDownload: true }),
        plain,
        origin,
        "/dashboard",
      ),
    ).toBeNull();
    expect(
      navTarget(
        link("/borrowers"),
        { ...plain, metaKey: true },
        origin,
        "/dashboard",
      ),
    ).toBeNull();
    expect(
      navTarget(
        link("/borrowers"),
        { ...plain, button: 1 },
        origin,
        "/dashboard",
      ),
    ).toBeNull();
  });

  it("ignores other sites and unparseable links", () => {
    expect(
      navTarget(link("https://elsewhere.test/x"), plain, origin, "/dashboard"),
    ).toBeNull();
    expect(
      navTarget(link("http://"), plain, "not a url", "/dashboard"),
    ).toBeNull();
  });
});

describe("splashLabel", () => {
  it("names the main pages and falls back to page", () => {
    expect(splashLabel("/dashboard")).toBe("dashboard");
    expect(splashLabel("/daily-checklist")).toBe("checklist");
    expect(splashLabel("/borrowers")).toBe("borrowers");
    expect(splashLabel("/borrowers/abc")).toBe("borrower");
    expect(splashLabel("/accounts/abc")).toBe("account");
    expect(splashLabel("/somewhere-new")).toBe("page");
  });
});
