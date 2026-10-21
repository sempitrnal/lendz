import { describe, expect, it } from "vitest";
import { buildReleaseView } from "@/lib/checklist/release-items";
import {
  releasedDayText,
  releaseNote,
  releaseOf,
  canLeaveCreate,
  classifySubmitSample,
  needsCreateConfirm,
  reduceCreateMarks,
  tickAfterCreateText,
  type CreateEvent,
  type CreateMarks,
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
    expect(releaseRowState(buildReleaseView(item(FULL)), undefined)).toBe(
      "create",
    );
  });

  it("shows Created for a ticked item", () => {
    expect(releaseRowState(buildReleaseView(item(FULL, true)), undefined)).toBe(
      "created",
    );
    expect(releaseRowState(buildReleaseView(item(FULL, true)), "created")).toBe(
      "created",
    );
  });

  it("never offers Create again once an account was made here", () => {
    expect(releaseRowState(buildReleaseView(item(FULL)), "created")).toBe(
      "check-off",
    );
  });

  it("is a plain row when the note does not parse, ticked or not", () => {
    expect(releaseRowState(buildReleaseView(item(PLAIN)), undefined)).toBe(
      "plain",
    );
    expect(
      releaseRowState(buildReleaseView(item(PLAIN, true)), undefined),
    ).toBe("plain");
    expect(
      releaseRowState(buildReleaseView(item("no mention 5,000")), undefined),
    ).toBe("plain");
  });
});

describe("collection rows under released", () => {
  it("parse as an amount but are never a release", () => {
    const view = buildReleaseView(item(COLLECTION));
    expect(view.parsed).not.toBeNull();
    expect(releaseOf(view)).toBeNull();
    expect(releaseRowState(view, undefined)).toBe("plain");
    expect(
      releaseRowState(buildReleaseView(item(COLLECTION, true)), undefined),
    ).toBe("plain");
    expect(releaseSummary(view)).toBeNull();
    expect(
      releaseTotal([view, buildReleaseView(item(FULL, false, "i2"))]),
    ).toBe(10000);
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

describe("reduceCreateMarks", () => {
  const empty: CreateMarks = new Map();
  const at = (marks: CreateMarks) => Object.fromEntries(marks);
  const run = (types: CreateEvent["type"][], id = "a", from = empty) =>
    types.reduce((m, type) => reduceCreateMarks(m, { type, id }), from);

  it("marks creating on submit, and a double submit changes nothing", () => {
    const once = run(["submit"]);
    expect(at(once)).toEqual({ a: "creating" });
    expect(reduceCreateMarks(once, { type: "submit", id: "a" })).toBe(once);
  });

  it("idle before success: busy, re-enabled, then success lands → created", () => {
    // The form resets (button enabled) before its last await and onSuccess.
    const between = run(["submit", "ended"]);
    expect(at(between)).toEqual({ a: "attempted" });
    // In between, reopening asks first and the row never offers Create.
    expect(needsCreateConfirm(between.get("a"))).toBe(true);
    expect(
      releaseRowState(
        buildReleaseView(item(FULL, false, "a")),
        between.get("a"),
      ),
    ).toBe("attempted");
    expect(
      at(reduceCreateMarks(between, { type: "success", id: "a" })),
    ).toEqual({ a: "created" });
  });

  it("busy then re-enabled with no success → attempted → confirm → idle", () => {
    const attempted = run(["submit", "ended"]);
    expect(at(attempted)).toEqual({ a: "attempted" });
    // Pressing Create while attempted does not start a run by itself.
    expect(reduceCreateMarks(attempted, { type: "submit", id: "a" })).toBe(
      attempted,
    );
    const confirmed = reduceCreateMarks(attempted, {
      type: "confirm",
      id: "a",
    });
    expect(at(confirmed)).toEqual({});
    expect(at(run(["submit"], "a", confirmed))).toEqual({ a: "creating" });
  });

  it("a failed validation goes back to idle at once (no confirmation)", () => {
    const m = run(["submit", "invalid"]);
    expect(at(m)).toEqual({});
    expect(needsCreateConfirm(m.get("a"))).toBe(false);
    expect(at(run(["submit", "invalid", "submit"]))).toEqual({ a: "creating" });
  });

  it("the form going away while busy falls to attempted, never stays creating", () => {
    expect(at(run(["submit", "lost"]))).toEqual({ a: "attempted" });
    expect(at(run(["submit", "lost", "success"]))).toEqual({ a: "created" });
  });

  it("success counts from any state", () => {
    for (const before of [
      [],
      ["submit"],
      ["submit", "ended"],
      ["submit", "invalid"],
      ["submit", "ended", "confirm"],
    ] as CreateEvent["type"][][]) {
      expect(at(run([...before, "success"]))).toEqual({ a: "created" });
    }
  });

  it("created is final: later events change nothing", () => {
    const created = run(["success"]);
    for (const type of [
      "submit",
      "invalid",
      "ended",
      "lost",
      "confirm",
    ] as const) {
      expect(reduceCreateMarks(created, { type, id: "a" })).toBe(created);
    }
  });

  it("stray events on an idle item change nothing", () => {
    for (const type of ["invalid", "ended", "lost", "confirm"] as const) {
      expect(reduceCreateMarks(empty, { type, id: "a" })).toBe(empty);
    }
  });

  it("keeps other items' marks", () => {
    let m = run(["success"], "a");
    m = run(["submit", "invalid"], "b", m);
    expect(at(m)).toEqual({ a: "created" });
  });

  it("blocks leaving (close, other sheets, check-off) only while busy", () => {
    expect(canLeaveCreate(run(["submit"]).get("a"))).toBe(false);
    expect(canLeaveCreate(run(["submit", "ended"]).get("a"))).toBe(true);
    expect(canLeaveCreate(undefined)).toBe(true);
    expect(canLeaveCreate("created")).toBe(true);
  });

  it("drives the row: Creating…, then never Create account again", () => {
    const view = buildReleaseView(item(FULL));
    let m = run(["submit"], "i1");
    expect(releaseRowState(view, m.get("i1"))).toBe("creating");
    m = reduceCreateMarks(m, { type: "success", id: "i1" });
    expect(releaseRowState(view, m.get("i1"))).toBe("check-off");
    expect(
      releaseRowState(buildReleaseView(item(FULL, true)), m.get("i1")),
    ).toBe("created");
  });
});

describe("classifySubmitSample", () => {
  const base = {
    buttonDisabled: false,
    seenBusy: false,
    fieldErrors: 0,
    elapsedMs: 0,
  };

  it("waits while the button is busy", () => {
    expect(classifySubmitSample({ ...base, buttonDisabled: true })).toBe(
      "wait",
    );
    expect(
      classifySubmitSample({ ...base, buttonDisabled: true, fieldErrors: 2 }),
    ).toBe("wait");
  });

  it("a field error once enabled is a failed validation, busy seen or not", () => {
    expect(classifySubmitSample({ ...base, fieldErrors: 1 })).toBe("invalid");
    expect(
      classifySubmitSample({ ...base, fieldErrors: 1, seenBusy: true }),
    ).toBe("invalid");
  });

  it("busy seen and enabled with no error is a real submit that ended", () => {
    expect(classifySubmitSample({ ...base, seenBusy: true })).toBe("ended");
  });

  it("never busy and no error: waits, then takes the safe side", () => {
    expect(classifySubmitSample({ ...base, elapsedMs: 300 })).toBe("wait");
    expect(classifySubmitSample({ ...base, elapsedMs: 1000 })).toBe("ended");
  });
});

describe("tickAfterCreateText", () => {
  it("says nothing when the tick saved", () => {
    expect(tickAfterCreateText("saved", false)).toBeNull();
    expect(tickAfterCreateText("saved", true)).toBeNull();
  });

  it("never claims the account exists when it was only queued", () => {
    for (const outcome of ["queued", "failed"] as const) {
      expect(tickAfterCreateText(outcome, true)).not.toMatch(/created/i);
    }
    expect(tickAfterCreateText("failed", true)).toBe(
      "The item couldn't be checked off. Tap Check off to try again.",
    );
  });

  it("says the account was created only when it saved", () => {
    expect(tickAfterCreateText("failed", false)).toBe(
      "Account created, but the item couldn't be checked off. Tap Check off to try again.",
    );
  });

  it("a queued tick is neutral either way", () => {
    expect(tickAfterCreateText("queued", false)).toBe(
      "Checked off on this device; it syncs when you're back online.",
    );
    expect(tickAfterCreateText("queued", true)).toBe(
      tickAfterCreateText("queued", false),
    );
  });
});
