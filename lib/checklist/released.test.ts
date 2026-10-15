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
    const r = parseReleasedLabel(
      `${mention} 3,000- c.a. for 103026`,
      "2026-10-14",
    );
    expect(r?.initialValues.principal_amount).toBe(3000);
    expect(r?.initialValues.first_payment_date).toBe("2026-10-30");
  });

  it("ignores an invalid date token", () => {
    const r = parseReleasedLabel(`${mention} 500 for 133026`, "2026-10-14");
    expect(r?.initialValues.type).toBe("loan");
    expect(r?.initialValues.first_payment_date).toBeUndefined();
  });

  it("parses a term in months", () => {
    const vanessa = parseReleasedLabel(
      `[vanessa  pestanas ](https://lendz-theta.vercel.app/borrowers/${ID})12,555-  renew  for   15k (8) months   to pay.create account`,
      "2026-10-15",
    );
    // 12,555 is the net release (15k minus the old 2,445 balance).
    expect(vanessa?.initialValues).toMatchObject({
      type: "loan",
      principal_amount: 15000,
      term_months: 8,
    });

    const julie = parseReleasedLabel(
      `${mention}70,000 -  renew  for   (12) MONTHS TO PAY`,
      "2026-10-15",
    );
    expect(julie?.initialValues).toMatchObject({
      principal_amount: 70000,
      term_months: 12,
    });

    expect(
      parseReleasedLabel(`${mention} 5,000 6mos`, "2026-10-15")?.initialValues
        .term_months,
    ).toBe(6);
  });

  it("uses the renew-for amount as the principal", () => {
    const amount = (label: string) =>
      parseReleasedLabel(`${mention} ${label}`, "2026-10-15")?.initialValues
        .principal_amount;
    expect(amount("12,555- renew for 15,000 (8) months")).toBe(15000);
    expect(amount("4,100 renew for 7.5k")).toBe(7500);
    // A term right after "renew for" isn't an amount.
    expect(amount("70,000 - renew for 12 months to pay")).toBe(70000);
  });

  it("leaves the term unset when none is given", () => {
    const r = parseReleasedLabel(
      `${mention} 3,000- c.a. for 103026`,
      "2026-10-14",
    );
    expect(r?.initialValues.term_months).toBeUndefined();
  });

  it("returns null without a mention or amount", () => {
    expect(parseReleasedLabel("john 1,000 c.a.", "2026-10-14")).toBeNull();
    expect(parseReleasedLabel(`${mention} c.a.`, "2026-10-14")).toBeNull();
  });
});
