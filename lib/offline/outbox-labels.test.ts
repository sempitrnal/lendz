import { describe, expect, it } from "vitest";
import { describeOutboxRequest, summarizeOutbox } from "./outbox-labels";

const REST = "https://x.supabase.co/rest/v1";
const body = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).buffer;

describe("describeOutboxRequest", () => {
  it("names a checklist item being added", () => {
    expect(
      describeOutboxRequest({
        url: `${REST}/daily_checklist_items?select=id`,
        method: "POST",
        body: body({ label: "bo test 12345 ca" }),
      }),
    ).toBe("Add “bo test 12345 ca” to checklist");
  });

  it("uses the saved label when an item is ticked", () => {
    expect(
      describeOutboxRequest(
        {
          url: `${REST}/daily_checklist_items?id=eq.abc`,
          method: "PATCH",
          body: body({ is_checked: true }),
        },
        (id) => (id === "abc" ? "bo test" : undefined),
      ),
    ).toBe("Tick “bo test”");
  });

  it("shows the principal for a new account", () => {
    expect(
      describeOutboxRequest({
        url: `${REST}/accounts?select=*`,
        method: "POST",
        body: body({ principal_amount: 5000 }),
      }),
    ).toMatch(/^New account · ₱5,000$/);
  });

  it("counts a batch of schedules", () => {
    expect(
      describeOutboxRequest({
        url: `${REST}/payment_schedules`,
        method: "POST",
        body: body([{}, {}, {}]),
      }),
    ).toBe("Add 3 payment schedules");
  });

  it("calls a server action a background update", () => {
    expect(
      describeOutboxRequest({
        url: "https://app.test/dashboard",
        method: "POST",
        headers: { "next-action": "abc" },
      }),
    ).toBe("Background update");
  });
});

describe("summarizeOutbox", () => {
  it("folds runs of the same change", () => {
    const action = {
      url: "https://app.test/x",
      method: "POST",
      headers: { "next-action": "1" },
    };
    expect(
      summarizeOutbox([action, action, { ...action, failed: true }]),
    ).toEqual([
      { label: "Background update", count: 2, failed: false },
      { label: "Background update", count: 1, failed: true },
    ]);
  });
});
