import { describe, expect, it } from "vitest";
import { buildReleaseView } from "@/lib/checklist/release-items";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const item = (label: string, is_checked = false): DailyChecklistItem => ({
  id: "i1",
  checklist_date: "2026-10-19",
  label,
  is_checked,
  sort_order: 0,
  created_at: "2026-10-19T00:00:00Z",
  category_id: "r",
  daily_checklist_categories: null,
});

describe("buildReleaseView", () => {
  const label = "[carla mendoza](/borrowers/b1) 10,000 - 10 months for 110426";

  it("parses a full release label", () => {
    const view = buildReleaseView(item(label));
    expect(view.parsed?.initialValues).toMatchObject({
      principal_amount: 10000,
      term_months: 10,
      first_payment_date: "2026-11-04",
    });
    expect(view.name).toBe("carla mendoza");
    expect(view.typed).toBe("carla mendoza 10,000 - 10 months for 110426");
    expect(view.created).toBe(false);
  });

  it("mirrors is_checked in created", () => {
    expect(buildReleaseView(item(label, true)).created).toBe(true);
  });

  it("gives parsed null when there is no amount", () => {
    const view = buildReleaseView(item("[carla mendoza](/borrowers/b1) hello"));
    expect(view.parsed).toBeNull();
    expect(view.name).toBe("carla mendoza");
  });
});
