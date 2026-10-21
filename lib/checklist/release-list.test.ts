import { describe, expect, it } from "vitest";
import { buildReleaseView } from "@/lib/checklist/release-items";
import {
  releasedDayText,
  releaseNote,
  releaseOf,
  releaseRowState,
  releaseSummary,
  releaseTotal,
} from "@/lib/checklist/release-list";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const item = (
  label: string,
  is_checked = false,
  id = "i1",
): DailyChecklistItem => ({
  id,
  checklist_date: "2026-10-19",
  label,
  is_checked,
  sort_order: 0,
  created_at: "2026-10-19T00:00:00Z",
  category_id: "r",
  daily_checklist_categories: null,
});

const FULL = "[carla mendoza](/borrowers/b1) 10,000 - 10 months for 110426";
const PLAIN = "[carla mendoza](/borrowers/b1) hello";
/** A collection row (installment badge) filed under "released". */
const COLLECTION =
  "[adam abbas](/borrowers/b9)\n₱2,158.33 [Oct 20](#badge:date:2026-10-20|s1) [Loan](#badge:type:loan)";

describe("releaseRowState", () => {
  it("offers Create account for a parsed, unticked item", () => {
    expect(releaseRowState(buildReleaseView(item(FULL)), false)).toBe(
      "create",
    );
  });

  it("shows Created for a ticked item", () => {
    expect(releaseRowState(buildReleaseView(item(FULL, true)), false)).toBe(
      "created",
    );
    expect(releaseRowState(buildReleaseView(item(FULL, true)), true)).toBe(
      "created",
    );
  });

  it("never offers Create again once an account was made here", () => {
    expect(releaseRowState(buildReleaseView(item(FULL)), true)).toBe(
      "check-off",
    );
  });

  it("is a plain row when the note does not parse, ticked or not", () => {
    expect(releaseRowState(buildReleaseView(item(PLAIN)), false)).toBe("plain");
    expect(releaseRowState(buildReleaseView(item(PLAIN, true)), false)).toBe(
      "plain",
    );
    expect(releaseRowState(buildReleaseView(item("no mention 5,000")), false))
      .toBe("plain");
  });
});

describe("collection rows under released", () => {
  it("parse as an amount but are never a release", () => {
    const view = buildReleaseView(item(COLLECTION));
    expect(view.parsed).not.toBeNull();
    expect(releaseOf(view)).toBeNull();
    expect(releaseRowState(view, false)).toBe("plain");
    expect(releaseRowState(buildReleaseView(item(COLLECTION, true)), false))
      .toBe("plain");
    expect(releaseSummary(view)).toBeNull();
    expect(releaseTotal([view, buildReleaseView(item(FULL, false, "i2"))]))
      .toBe(10000);
  });
});

describe("releaseNote", () => {
  it("drops the mention and collapses spaces", () => {
    expect(releaseNote(FULL)).toBe("10,000 - 10 months for 110426");
    expect(releaseNote("  a   [x](/borrowers/1)  b ")).toBe("a b");
    expect(releaseNote(COLLECTION)).toBe("₱2,158.33 Oct 20 Loan");
  });
});

describe("releaseSummary", () => {
  it("reads the parsed note without the Reads as prefix", () => {
    expect(releaseSummary(buildReleaseView(item(FULL)))).toBe(
      "₱10,000 loan · 10 months · first payment Nov 4, 2026",
    );
  });

  it("is null when the note does not parse", () => {
    expect(releaseSummary(buildReleaseView(item(PLAIN)))).toBeNull();
  });
});

describe("releaseTotal", () => {
  it("adds the parsed principals, ticked or not, and skips plain rows", () => {
    const views = [
      item(FULL),
      item("[a](/borrowers/b2) 5,000.10 c.a. for 110426", true, "i2"),
      item(PLAIN, false, "i3"),
      item("[b](/borrowers/b3) 0.20 - 1 month", false, "i4"),
    ].map(buildReleaseView);
    expect(releaseTotal(views)).toBe(15000.3);
  });

  it("adds in centavos (no float drift)", () => {
    const views = [
      item("[a](/borrowers/b1) 0.10", false, "a"),
      item("[b](/borrowers/b2) 0.20", false, "b"),
    ].map(buildReleaseView);
    expect(releaseTotal(views)).toBe(0.3);
  });

  it("is 0 with nothing parsed", () => {
    expect(releaseTotal([])).toBe(0);
    expect(releaseTotal([buildReleaseView(item(PLAIN))])).toBe(0);
  });
});

describe("releasedDayText", () => {
  it("says today or this day", () => {
    expect(releasedDayText(true)).toBe("released today");
    expect(releasedDayText(false)).toBe("released this day");
  });
});
