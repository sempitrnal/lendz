import { describe, expect, it } from "vitest";
import {
  isPatternDate,
  monthRange,
  planDates,
  planEntries,
  planTotal,
  shiftMonth,
  shortAmount,
} from "@/lib/checklist/release-plan";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const item = (
  id: string,
  date: string,
  label: string,
  extra: Partial<DailyChecklistItem> = {},
): DailyChecklistItem => ({
  id,
  checklist_date: date,
  label,
  is_checked: false,
  sort_order: 0,
  created_at: `${date}T00:00:00Z`,
  category_id: "r",
  daily_checklist_categories: null,
  ...extra,
});

describe("planDates", () => {
  it("lists the pattern days in order", () => {
    expect(planDates("2026-11").map((d) => Number(d.slice(8)))).toEqual([
      4, 5, 7, 8, 10, 15, 19, 20, 22, 23, 25, 30,
    ]);
  });

  it("moves the 30th to the end of February", () => {
    expect(planDates("2027-02").at(-1)).toBe("2027-02-28");
    expect(planDates("2028-02").at(-1)).toBe("2028-02-29");
  });

  it("adds other days of the month in order, once", () => {
    expect(
      planDates("2026-11", ["2026-11-28", "2026-11-05", "2026-12-01"]),
    ).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-07",
      "2026-11-08",
      "2026-11-10",
      "2026-11-15",
      "2026-11-19",
      "2026-11-20",
      "2026-11-22",
      "2026-11-23",
      "2026-11-25",
      "2026-11-28",
      "2026-11-30",
    ]);
  });
});

describe("isPatternDate", () => {
  it("tells the pattern days from custom ones", () => {
    expect(isPatternDate("2026-11-04")).toBe(true);
    expect(isPatternDate("2026-11-28")).toBe(false);
    expect(isPatternDate("2027-02-28")).toBe(true);
  });
});

describe("months", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("spans the whole month", () => {
    expect(monthRange("2026-11")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });
});

describe("planEntries", () => {
  it("reads releases by date and skips other rows", () => {
    const map = planEntries(
      [
        item("a", "2026-11-05", "[mila](/borrowers/m) 20,000 - 4 months"),
        item("b", "2026-11-05", "[bo](/borrowers/b) 50,000", {
          sort_order: -1,
          is_checked: true,
        }),
        item("c", "2026-11-05", "groceries", { category_id: "other" }),
        item(
          "d",
          "2026-11-05",
          "[bo](/borrowers/b) 1,000 [nov 5](#badge:date:2026-11-05|s1)",
        ),
        item("e", "2026-11-08", "call damoko"),
      ],
      "r",
      [
        {
          id: "b",
          first_name: "bo",
          last_name: "",
          contact: null,
          borrower_categories: [
            { category: [{ id: "c1", name: "market", color: "#16a34a" }] },
          ],
        },
      ],
    );
    expect(map.get("2026-11-05")).toEqual([
      {
        id: "b",
        date: "2026-11-05",
        name: "bo",
        borrowerId: "b",
        amount: 50000,
        kind: "loan",
        term: null,
        category: { name: "market", color: "#16a34a" },
        done: true,
      },
      {
        id: "a",
        date: "2026-11-05",
        name: "mila",
        borrowerId: "m",
        amount: 20000,
        kind: "loan",
        term: "4 mo",
        category: null,
        done: false,
      },
    ]);
    expect(map.get("2026-11-08")).toEqual([
      {
        id: "e",
        date: "2026-11-08",
        name: "call damoko",
        borrowerId: null,
        amount: null,
        kind: null,
        term: null,
        category: null,
        done: false,
      },
    ]);
    expect(planTotal(map.get("2026-11-05")!)).toBe(70000);
  });
});

describe("shortAmount", () => {
  it("reads a cash advance", () => {
    const [entry] = planEntries(
      [item("f", "2026-11-10", "[ana](/borrowers/a) 3,000 c.a.")],
      "r",
    ).get("2026-11-10")!;
    expect(entry.kind).toBe("cash_advance");
  });

  it("writes thousands as k", () => {
    expect(shortAmount(50000)).toBe("50k");
    expect(shortAmount(2500)).toBe("2.5k");
    expect(shortAmount(12345)).toBe("12.3k");
    expect(shortAmount(800)).toBe("800");
    expect(shortAmount(1380600)).toBe("1.38M");
    expect(shortAmount(2000000)).toBe("2M");
  });
});
