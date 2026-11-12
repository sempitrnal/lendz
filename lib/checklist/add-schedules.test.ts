import { describe, expect, it } from "vitest";
import { addSchedulesToChecklist } from "@/lib/checklist/add-schedules";

type Row = Record<string, unknown>;

function fakeDb(items: Row[], mode = "auto") {
  const inserted: Row[] = [];
  const updated: { id: string; patch: Row }[] = [];
  const schedules = [
    {
      id: "s1",
      due_date: "2026-11-10",
      amount_due: 1000,
      accounts: {
        type: "loan",
        schedule_mode: mode,
        borrower_id: "b1",
        borrowers: { first_name: "Ana", last_name: "Cruz" },
      },
    },
  ];
  const chain = (data: unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ["in", "eq"]) q[m] = () => q;
    q.then = (r: (v: unknown) => unknown) => r({ data, error: null });
    return q;
  };
  const db = {
    from(table: string) {
      return {
        select: () =>
          table === "payment_schedules"
            ? chain(schedules)
            : table === "daily_checklist_categories"
              ? chain([{ id: "c1", name: "Collect", color: "#000", sort_order: 0 }])
              : chain(items),
        insert: (rows: Row[]) => {
          inserted.push(...rows);
          return Promise.resolve({ error: null });
        },
        update: (patch: Row) => ({
          eq: (_: string, id: string) => {
            updated.push({ id, patch });
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  };
  return { db: db as never, inserted, updated };
}

const OLD =
  "[ana cruz](/borrowers/b1)\n₱500 [Nov 5](#badge:date:2026-11-05|s0) [Loan](#badge:type:loan)";

describe("addSchedulesToChecklist", () => {
  it("adds a row for a borrower who isn't listed", async () => {
    const t = fakeDb([]);
    const r = await addSchedulesToChecklist(t.db, "2026-11-13", ["s1"]);
    expect(r).toEqual({ added: 1, appended: 0 });
    expect(String(t.inserted[0].label)).toContain("|s1");
  });

  it("appends under the borrower's existing row", async () => {
    const t = fakeDb([{ id: "r1", label: OLD, sort_order: 0, category_id: "c1" }]);
    const r = await addSchedulesToChecklist(t.db, "2026-11-13", ["s1"]);
    expect(r).toEqual({ added: 0, appended: 1 });
    expect(String(t.updated[0].patch.label)).toContain("|s0");
    expect(String(t.updated[0].patch.label)).toContain("|s1");
    expect(String(t.updated[0].patch.label)).toContain("Total: ₱1,500");
  });

  it("leaves a schedule the day already lists", async () => {
    const label = OLD.replace("s0", "s1");
    const t = fakeDb([{ id: "r1", label, sort_order: 0, category_id: "c1" }]);
    expect(await addSchedulesToChecklist(t.db, "2026-11-13", ["s1"])).toEqual({
      added: 0,
      appended: 0,
    });
  });

  it("skips manual accounts", async () => {
    const t = fakeDb([], "manual");
    expect(await addSchedulesToChecklist(t.db, "2026-11-13", ["s1"])).toEqual({
      added: 0,
      appended: 0,
    });
  });
});
