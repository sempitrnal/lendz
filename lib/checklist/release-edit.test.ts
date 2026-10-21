import { describe, expect, it } from "vitest";
import { buildReleaseView } from "@/lib/checklist/release-items";
import {
  planReleaseEdit,
  releaseDisplayName,
  releaseEditText,
} from "@/lib/checklist/release-edit";
import type { DailyChecklistItem } from "@/lib/checklist/types";

function item(label: string): DailyChecklistItem {
  return {
    id: "r1",
    checklist_date: "2026-10-19",
    label,
    is_checked: false,
    sort_order: 0,
    created_at: "2026-10-01T00:00:00Z",
    category_id: null,
    daily_checklist_categories: null,
  };
}

const WITH_BORROWER =
  "[carla mendoza](/borrowers/b1) 10,000 - 10 months for 110426";

describe("releaseEditText", () => {
  it("is the note without the borrower's mention", () => {
    expect(releaseEditText(buildReleaseView(item(WITH_BORROWER)))).toBe(
      "10,000 - 10 months for 110426",
    );
  });

  it("is the whole text when there is no borrower", () => {
    expect(releaseEditText(buildReleaseView(item("  bring   cash  ")))).toBe(
      "bring cash",
    );
  });
});

describe("planReleaseEdit", () => {
  const view = buildReleaseView(item(WITH_BORROWER));

  it("keeps the borrower's mention and replaces the note", () => {
    const plan = planReleaseEdit(view, "20,000 - 6 months for 110426");
    expect(plan.action).toBe("save");
    if (plan.action !== "save") return;
    expect(plan.label).toBe(
      "[carla mendoza](/borrowers/b1) 20,000 - 6 months for 110426",
    );
    expect(plan.parsed?.initialValues.principal_amount).toBe(20000);
    expect(plan.parsed?.initialValues.term_months).toBe(6);
  });

  it("blocks an empty note", () => {
    expect(planReleaseEdit(view, "   ")).toEqual({ action: "blocked" });
  });

  it("saves nothing when the text is the same", () => {
    expect(planReleaseEdit(view, "10,000 - 10 months for 110426")).toEqual({
      action: "unchanged",
    });
    expect(planReleaseEdit(view, "  10,000 - 10  months for 110426 ")).toEqual({
      action: "unchanged",
    });
  });

  it("a note that no longer reads as a release saves with no parse", () => {
    const plan = planReleaseEdit(view, "call first");
    expect(plan.action).toBe("save");
    if (plan.action !== "save") return;
    expect(plan.parsed).toBeNull();
  });

  it("without a borrower the label is the typed text", () => {
    const bare = buildReleaseView(item("bring cash"));
    const plan = planReleaseEdit(bare, "bring more cash");
    expect(plan).toMatchObject({ action: "save", label: "bring more cash" });
  });
});

describe("releaseDisplayName", () => {
  it("is the borrower, lowercase, else the text", () => {
    expect(releaseDisplayName(buildReleaseView(item(WITH_BORROWER)))).toBe(
      "carla mendoza",
    );
    expect(releaseDisplayName(buildReleaseView(item("Bring Cash")))).toBe(
      "bring cash",
    );
  });

  it("truncates a long text and never returns an empty name", () => {
    const long = releaseDisplayName(buildReleaseView(item("x".repeat(80))));
    expect(long.length).toBe(40);
    expect(long.endsWith("…")).toBe(true);
    expect(releaseDisplayName(buildReleaseView(item("   ")))).toBe("release");
  });
});
