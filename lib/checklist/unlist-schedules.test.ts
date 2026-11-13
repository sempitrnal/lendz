import { describe, expect, it } from "vitest";
import {
  listedByPopulate,
  unlistScheduleFromDay,
} from "@/lib/checklist/unlist-schedules";

describe("listedByPopulate", () => {
  it("is true for due today and up to a week late, false otherwise", () => {
    expect(listedByPopulate("2026-11-13", "2026-11-13")).toBe(true);
    expect(listedByPopulate("2026-11-06", "2026-11-13")).toBe(true);
    expect(listedByPopulate("2026-11-05", "2026-11-13")).toBe(false);
    expect(listedByPopulate("2026-11-15", "2026-11-13")).toBe(false);
  });
});

type Item = { id: string; label: string; is_checked: boolean };

function fakeDb(opts: { due: string; paidThatDay?: boolean; items: Item[] }) {
  const deleted: string[] = [];
  const updated: { id: string; label: string }[] = [];
  const chain = (data: unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ["eq", "ilike", "limit"]) q[m] = () => q;
    q.single = () => Promise.resolve({ data });
    q.then = (r: (v: unknown) => unknown) => r({ data });
    return q;
  };
  const db = {
    from(table: string) {
      return {
        select: () =>
          table === "payment_schedules"
            ? chain({ id: "s1", due_date: opts.due })
            : table === "schedule_payments"
              ? chain(opts.paidThatDay ? [{ id: "p" }] : [])
              : chain(opts.items),
        delete: () => ({
          eq: (_: string, id: string) => {
            deleted.push(id);
            return Promise.resolve({});
          },
        }),
        update: (patch: { label: string }) => ({
          eq: (_: string, id: string) => {
            updated.push({ id, label: patch.label });
            return Promise.resolve({});
          },
        }),
      };
    },
  };
  return { db: db as never, deleted, updated };
}

const label = (id: string) =>
  `[ana cruz](/borrowers/b1)\n₱500 [Nov 20](#badge:date:2026-11-20|${id}) [Loan](#badge:type:loan)`;

describe("unlistScheduleFromDay", () => {
  it("deletes a row that only linked the schedule", async () => {
    const t = fakeDb({
      due: "2026-11-20",
      items: [{ id: "r1", label: label("s1"), is_checked: false }],
    });
    expect(await unlistScheduleFromDay(t.db, "2026-11-13", "s1")).toBe(1);
    expect(t.deleted).toEqual(["r1"]);
  });

  it("keeps the row when another payment that day still lists it", async () => {
    const t = fakeDb({
      due: "2026-11-20",
      paidThatDay: true,
      items: [{ id: "r1", label: label("s1"), is_checked: false }],
    });
    expect(await unlistScheduleFromDay(t.db, "2026-11-13", "s1")).toBe(0);
    expect(t.deleted).toEqual([]);
  });

  it("keeps a schedule the day would list anyway", async () => {
    const t = fakeDb({
      due: "2026-11-12",
      items: [{ id: "r1", label: label("s1"), is_checked: false }],
    });
    expect(await unlistScheduleFromDay(t.db, "2026-11-13", "s1")).toBe(0);
  });

  it("leaves a row that is already ticked off", async () => {
    const t = fakeDb({
      due: "2026-11-20",
      items: [{ id: "r1", label: label("s1"), is_checked: true }],
    });
    expect(await unlistScheduleFromDay(t.db, "2026-11-13", "s1")).toBe(0);
  });
});
