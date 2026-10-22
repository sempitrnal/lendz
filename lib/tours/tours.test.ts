import { describe, expect, it } from "vitest";
import { TOURS } from "@/lib/tours/tours";

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
});
