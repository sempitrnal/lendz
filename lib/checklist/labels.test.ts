import { describe, expect, it } from "vitest";
import {
  buildDueLabel,
  extractBorrowerId,
  extractBorrowerMention,
  extractScheduleRefs,
  formatShortDate,
  parseExistingNext,
  parseMentions,
  rewriteNextBlock,
  type NextCollectionItem,
} from "@/lib/checklist/labels";
import type { DueChecklistGroup } from "@/lib/checklist/types";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const BORROWER = "394b274c-8b5f-4f9a-8391-02d9354f7ba0";

const group: DueChecklistGroup = {
  borrower_id: BORROWER,
  name: "Bo Test",
  items: [
    { id: ID_A, due_date: "2026-10-10", amount: 1450, type: "loan" },
    { id: ID_B, due_date: "2026-10-10", amount: 2400.5, type: "cash_advance" },
  ],
};

const item = (
  id: string,
  amount: number,
  type: "loan" | "cash_advance" = "loan",
): NextCollectionItem => ({ id, due_date: "2026-10-10", amount, type });

describe("formatShortDate", () => {
  it("formats an ISO date as 'Mon D'", () => {
    expect(formatShortDate("2026-10-10")).toBe("Oct 10");
    expect(formatShortDate("2026-01-05T00:00:00+00:00")).toBe("Jan 5");
  });
});

describe("extractBorrowerId / extractBorrowerMention", () => {
  it("reads the id from a borrower href", () => {
    expect(extractBorrowerId(`/borrowers/${BORROWER}`)).toBe(BORROWER);
    expect(extractBorrowerId("#badge:type:loan")).toBeNull();
  });

  it("returns the first borrower mention and skips badges", () => {
    const label = `[Oct 10](#badge:date:2026-10-10|${ID_A}) [bo test](/borrowers/${BORROWER})`;
    expect(extractBorrowerMention(label)).toEqual({
      id: BORROWER,
      name: "bo test",
    });
    expect(extractBorrowerMention("plain text")).toBeNull();
  });
});

describe("extractScheduleRefs", () => {
  it("collects schedule ids from date badges in order", () => {
    const label = [
      `[bo test](/borrowers/${BORROWER})`,
      `₱1,450 [Oct 10](#badge:date:2026-10-10|${ID_A}) [Loan](#badge:type:loan)`,
      `₱2,400 [Oct 25](#badge:date:2026-10-25|${ID_B}) [Loan](#badge:type:loan)`,
    ].join("\n");
    expect(extractScheduleRefs(label)).toEqual([
      { id: ID_A, due_date: "2026-10-10" },
      { id: ID_B, due_date: "2026-10-25" },
    ]);
  });

  it("ignores legacy badges without an id", () => {
    expect(
      extractScheduleRefs(
        "₱5 [Oct 10](#badge:date:2026-10-10) [Loan](#badge:type:loan)",
      ),
    ).toEqual([]);
  });
});

describe("buildDueLabel", () => {
  it("writes mention, one line per collection and a Total when several", () => {
    const label = buildDueLabel(group);
    expect(label.split("\n")).toEqual([
      `[bo test](/borrowers/${BORROWER})`,
      `₱1,450 [Oct 10](#badge:date:2026-10-10|${ID_A}) [Loan](#badge:type:loan)`,
      `₱2,400.5 [Oct 10](#badge:date:2026-10-10|${ID_B}) [CA](#badge:type:cash_advance)`,
      "Total: ₱3,850.5",
    ]);
  });

  it("omits the Total for a single collection", () => {
    const label = buildDueLabel({ ...group, items: [group.items[0]] });
    expect(label).not.toContain("Total");
  });

  it("round-trips through the parsers", () => {
    const label = buildDueLabel(group);
    expect(extractScheduleRefs(label).map((r) => r.id)).toEqual([ID_A, ID_B]);
    expect(parseExistingNext(label)).toEqual([
      {
        id: ID_A,
        due_date: "2026-10-10",
        amount: 1450,
        type: "loan",
        existing: true,
      },
      {
        id: ID_B,
        due_date: "2026-10-10",
        amount: 2400.5,
        type: "cash_advance",
        existing: true,
      },
    ]);
  });
});

describe("parseExistingNext", () => {
  it("ignores the /next token, Total lines and free text", () => {
    const label = `[bo test](/borrowers/${BORROWER})\n₱1,035 [Oct 10](#badge:date:2026-10-10|${ID_A}) [Loan](#badge:type:loan)\nTotal: ₱1,035 /next\nnote`;
    expect(parseExistingNext(label).map((i) => i.id)).toEqual([ID_A]);
  });

  it("defaults the type to loan when the type badge is missing", () => {
    const label = `₱500 [Oct 10](#badge:date:2026-10-10|${ID_A})`;
    expect(parseExistingNext(label)[0].type).toBe("loan");
  });

  it("skips legacy lines that carry no schedule id", () => {
    const label =
      "₱500 [Oct 10](#badge:date:2026-10-10) [Loan](#badge:type:loan)";
    expect(parseExistingNext(label)).toEqual([]);
  });
});

describe("rewriteNextBlock", () => {
  const base = buildDueLabel(group);

  it("removes one collection and the stale Total", () => {
    const next = rewriteNextBlock(`${base} /next`, [item(ID_A, 1450)])!;
    expect(next.split("\n")).toEqual([
      `[bo test](/borrowers/${BORROWER})`,
      `₱1,450 [Oct 10](#badge:date:2026-10-10|${ID_A}) [Loan](#badge:type:loan)`,
    ]);
  });

  it("adds a collection and recomputes the Total", () => {
    const single = buildDueLabel({ ...group, items: [group.items[0]] });
    const next = rewriteNextBlock(`${single} /next`, [
      item(ID_A, 1450),
      item(ID_B, 2400, "cash_advance"),
    ])!;
    expect(next).toContain("Total: ₱3,850");
    expect(extractScheduleRefs(next).map((r) => r.id)).toEqual([ID_A, ID_B]);
  });

  it("removes everything when nothing is selected", () => {
    const next = rewriteNextBlock(`${base}\n/next`, [])!;
    expect(next).toBe(`[bo test](/borrowers/${BORROWER})`);
  });

  it("appends the block when no /next token exists (button flow)", () => {
    const next = rewriteNextBlock(`[bo test](/borrowers/${BORROWER})`, [
      item(ID_A, 1450),
    ])!;
    expect(next.split("\n")).toHaveLength(2);
    expect(extractScheduleRefs(next)).toHaveLength(1);
  });

  it("keeps free text that sits around the token", () => {
    const next = rewriteNextBlock(
      `[bo test](/borrowers/${BORROWER}) /next remind him`,
      [item(ID_A, 1450)],
    )!;
    const lines = next.split("\n");
    expect(lines[0]).toBe(`[bo test](/borrowers/${BORROWER})`);
    expect(lines[lines.length - 1]).toBe("remind him");
  });

  it("leaves legacy lines (no id) untouched", () => {
    const legacy =
      "₱500 [Oct 10](#badge:date:2026-10-10) [Loan](#badge:type:loan)";
    const next = rewriteNextBlock(`${legacy}\n/next`, [item(ID_A, 1450)])!;
    expect(next.split("\n")[0]).toBe(legacy);
    expect(extractScheduleRefs(next)).toHaveLength(1);
  });
});

describe("parseMentions", () => {
  const borrowers = [
    {
      id: "b1",
      first_name: "Ana",
      last_name: "Cruz",
      contact: null,
      borrower_categories: [],
    },
  ];

  it("finds markdown mentions and plain full names without overlap", () => {
    const label = "[ana cruz](/borrowers/b1) paid, then Ana Cruz again";
    const found = parseMentions(label, borrowers);
    expect(found.map((m) => [m.name, m.id])).toEqual([
      ["ana cruz", "b1"],
      ["Ana Cruz", "b1"],
    ]);
  });
});
