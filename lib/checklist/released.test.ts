import { describe, expect, it } from "vitest";
import { parseReleasedLabel } from "@/lib/checklist/released";

const ID = "394b274c-8b5f-4f9a-8391-02d9354f7ba0";
const mention = `[madelien ruelo](/borrowers/${ID})`;

describe("parseReleasedLabel", () => {
  it("parses a cash advance with a payroll note", () => {
    const r = parseReleasedLabel(
      `${mention} 1,000- c.a. for next payroll`,
      "2026-10-14",
    );
    expect(r?.borrowerId).toBe(ID);
    expect(r?.borrowerName).toBe("madelien ruelo");
    expect(r?.initialValues).toMatchObject({
      type: "cash_advance",
      principal_amount: 1000,
      release_date: "2026-10-14",
    });
    expect(r?.initialValues.first_payment_date).toBeUndefined();
  });

  it("parses an MMDDYY first payment date", () => {
    const r = parseReleasedLabel(`${mention} 3,000- c.a. for 103026`, "2026-10-14");
    expect(r?.initialValues.principal_amount).toBe(3000);
    expect(r?.initialValues.first_payment_date).toBe("2026-10-30");
  });

  it("ignores an invalid date token", () => {
    const r = parseReleasedLabel(`${mention} 500 for 133026`, "2026-10-14");
    expect(r?.initialValues.type).toBe("loan");
    expect(r?.initialValues.first_payment_date).toBeUndefined();
  });

  it("returns null without a mention or amount", () => {
    expect(parseReleasedLabel("john 1,000 c.a.", "2026-10-14")).toBeNull();
    expect(parseReleasedLabel(`${mention} c.a.`, "2026-10-14")).toBeNull();
  });
});
