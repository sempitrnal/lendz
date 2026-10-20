import { describe, expect, it } from "vitest";
import {
  addedBorrowersText,
  clearedItemsText,
  dueGroupsErrorText,
  dueGroupsUrl,
  markedPaidText,
  planUndoPopulate,
  undoPopulateText,
} from "@/lib/checklist/list-menu";

describe("toast texts", () => {
  it("pluralises", () => {
    expect(addedBorrowersText(1)).toBe("Added 1 borrower");
    expect(addedBorrowersText(4)).toBe("Added 4 borrowers");
    expect(markedPaidText(1)).toBe("Marked 1 collection paid");
    expect(markedPaidText(12)).toBe("Marked 12 collections paid");
    expect(clearedItemsText(1)).toBe("Cleared 1 item");
    expect(clearedItemsText(3)).toBe("Cleared 3 items");
  });

  it("reports an undo populate like the old widget", () => {
    expect(undoPopulateText(3, 0)).toBe("Removed 3 items");
    expect(undoPopulateText(1, 2)).toBe(
      "Removed 1 item (2 kept — edited or ticked)",
    );
  });

  it("loads seven days of carry-over and words a failed load", () => {
    expect(dueGroupsUrl("2026-10-20")).toBe(
      "/api/checklist/due?date=2026-10-20&back=7",
    );
    expect(dueGroupsErrorText(true)).toBe("Failed to load due collections");
    expect(dueGroupsErrorText(false)).toBe(
      "Due collections for this day aren't saved offline — reconnect to populate",
    );
  });
});

describe("planUndoPopulate", () => {
  const populated = [
    { id: "a", label: "ana" },
    { id: "b", label: "ben" },
    { id: "c", label: "cy" },
    { id: "d", label: "dee" },
  ];

  it("removes only rows still as populate left them", () => {
    const current = [
      { id: "a", label: "ana", is_checked: false },
      { id: "b", label: "ben edited", is_checked: false },
      { id: "c", label: "cy", is_checked: true },
      { id: "x", label: "other", is_checked: false },
    ];
    // "d" is gone already: neither removed nor kept.
    expect(planUndoPopulate(populated, current)).toEqual({
      removeIds: ["a"],
      kept: 2,
    });
  });

  it("removes nothing once every row is gone", () => {
    expect(planUndoPopulate(populated, [])).toEqual({ removeIds: [], kept: 0 });
  });
});
