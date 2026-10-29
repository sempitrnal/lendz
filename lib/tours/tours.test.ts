import { describe, expect, it } from "vitest";
import { nextTour } from "@/lib/tours/logic";
import { GUIDE_TOUR_ID, TOURS } from "@/lib/tours/tours";

describe("TOURS", () => {
  it("has unique, well-formed ids", () => {
    const ids = TOURS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
  });
  it("has steps, with data-tour targets, on a real page", () => {
    for (const t of TOURS) {
      expect(t.steps.length).toBeGreaterThan(0);
      expect(t.page.startsWith("/")).toBe(true);
      for (const s of t.steps) {
        expect(s.target).toMatch(/^\[data-tour="[a-z0-9-]+"\]$/);
      }
    }
  });
  it("a first visit to the checklist plays only the guide", () => {
    expect(nextTour(TOURS, "/daily-checklist", [])?.id).toBe(GUIDE_TOUR_ID);
    // Then only a tour for something shipped since plays by itself.
    const search = "2026-10-29-checklist-search";
    const folded = "2026-10-29-carried-folded";
    expect(nextTour(TOURS, "/daily-checklist", [GUIDE_TOUR_ID])?.id).toBe(
      search,
    );
    expect(
      nextTour(TOURS, "/daily-checklist", [GUIDE_TOUR_ID, search])?.id,
    ).toBe(folded);
    expect(
      nextTour(TOURS, "/daily-checklist", [GUIDE_TOUR_ID, search, folded]),
    ).toBeNull();
  });
  it("a borrower's page plays only the page guide", () => {
    expect(nextTour(TOURS, "/borrowers/abc", [])?.id).toBe(
      "2026-10-29-borrower-guide",
    );
    expect(
      nextTour(TOURS, "/borrowers/abc", ["2026-10-29-borrower-guide"]),
    ).toBeNull();
  });
});
