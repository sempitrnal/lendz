import { describe, expect, it } from "vitest";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import {
  activeBorrower,
  addMention,
  applyDuesSelection,
  canRemoveMention,
  chipText,
  detectNextTyped,
  duesStepButton,
  initialSelection,
  listedScheduleIds,
  manualFailureMessage,
  manualPaidMessage,
  manualPaymentCheck,
  manualQuickAmounts,
  offerDues,
  paidLine,
  releaseDraft,
  releaseReadBack,
  removeMention,
  submitPlan,
  suggestBorrowers,
  type DraftLine,
} from "@/lib/checklist/add-sheet";
import { composeLabel, labelParts } from "@/lib/checklist/composer";
import {
  buildDueLabel,
  collectionRowModel,
  rewriteNextBlock,
  type ManualAccount,
  type NextCollectionItem,
} from "@/lib/checklist/labels";
import { buildRowView } from "@/lib/checklist/row-state";
import { buildReleaseView } from "@/lib/checklist/release-items";
import { parseReleasedLabel } from "@/lib/checklist/released";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const DAY = "2026-10-20";
const nora = { id: "n1", name: "nora villanueva" };
const dante = { id: "d1", name: "dante uy" };
const tess = { id: "t1", name: "tess mercado" };

const search = (
  id: string,
  first: string,
  last: string,
): BorrowerSearchItem => ({
  id,
  first_name: first,
  last_name: last,
  contact: null,
  borrower_categories: [],
});

const due = (
  id: string,
  due_date: string,
  amount: number,
  type: "loan" | "cash_advance" = "loan",
): DraftLine => ({ id, due_date, amount, type });

const item = (
  id: string,
  label: string,
  extra: Partial<DailyChecklistItem> = {},
): DailyChecklistItem => ({
  id,
  checklist_date: DAY,
  label,
  is_checked: false,
  sort_order: 0,
  created_at: "2026-10-20T00:00:00Z",
  category_id: "c-collect",
  daily_checklist_categories: null,
  ...extra,
});

const base = {
  mode: "collect" as const,
  mentions: [] as { id: string; name: string }[],
  lines: [] as DraftLine[],
  text: "",
  date: DAY,
  editOf: null as string | null,
  collectId: "c-collect",
  releasedId: "c-released",
};

describe("suggestBorrowers", () => {
  const list = [
    search("n1", "Nora", "Villanueva"),
    search("n2", "Norma", "Reyes"),
    search("a1", "Ana", "Cruz"),
    search("l1", "Leonor", "Diaz"),
    search("n3", "Nori", "Tan"),
    search("n4", "Noreen", "Lim"),
  ];
  it("matches anywhere in the name, up to 4", () => {
    expect(suggestBorrowers(list, "nor").map((b) => b.id)).toEqual([
      "n1",
      "n2",
      "l1",
      "n3",
    ]);
  });
  it("skips borrowers already mentioned", () => {
    expect(suggestBorrowers(list, "NOR", ["n1"]).map((b) => b.id)).toEqual([
      "n2",
      "l1",
      "n3",
      "n4",
    ]);
  });
  it("an empty query lists the first few", () => {
    expect(suggestBorrowers(list, "")).toHaveLength(4);
  });
});

describe("mentions", () => {
  it("the last mention is the active borrower", () => {
    expect(activeBorrower([nora, dante])).toEqual(dante);
    expect(activeBorrower([])).toBeNull();
  });
  it("a new active borrower drops the previous borrower's dues", () => {
    const r = addMention("collect", [nora], [due("s1", DAY, 100)], dante);
    expect(r).toEqual({ mentions: [nora, dante], lines: [] });
  });
  it("mentioning the active borrower again changes nothing", () => {
    const lines = [due("s1", DAY, 100)];
    expect(addMention("collect", [nora], lines, nora)).toEqual({
      mentions: [nora],
      lines,
    });
  });
  it("re-mentioning an earlier borrower makes it active", () => {
    expect(addMention("collect", [nora, dante], [], nora).mentions).toEqual([
      dante,
      nora,
    ]);
  });
  it("a saved payment locks the active borrower", () => {
    const lines: DraftLine[] = [{ ...due("p1", DAY, 500), paid: true }];
    const r = addMention("collect", [nora], lines, dante);
    expect(r.mentions).toEqual([dante, nora]);
    expect(r.lines).toBe(lines);
    expect(canRemoveMention(r.mentions, lines, "n1")).toBe(false);
    expect(canRemoveMention(r.mentions, lines, "d1")).toBe(true);
    expect(removeMention(r.mentions, lines, "n1").mentions).toEqual(r.mentions);
  });
  it("release mode keeps one borrower", () => {
    expect(addMention("release", [nora], [], dante).mentions).toEqual([dante]);
  });
  it("removing the active borrower drops its dues; another keeps them", () => {
    const lines = [due("s1", DAY, 100)];
    expect(removeMention([nora, dante], lines, "d1")).toEqual({
      mentions: [nora],
      lines: [],
    });
    expect(removeMention([nora, dante], lines, "n1")).toEqual({
      mentions: [dante],
      lines,
    });
  });
});

describe("detectNextTyped", () => {
  it("opens on a newly typed /next and removes it", () => {
    expect(detectNextTyped("@x pay /nex", "@x pay /next")).toEqual({
      text: "@x pay",
      opened: true,
    });
    expect(detectNextTyped("", "/next")).toEqual({ text: "", opened: true });
  });
  it("keeps a /next that was already in the note", () => {
    expect(detectNextTyped("/next week", "/next weeks")).toEqual({
      text: "/next weeks",
      opened: false,
    });
  });
  it("removes only the new token when one was already there", () => {
    expect(detectNextTyped("/next week ", "/next week /next")).toEqual({
      text: "/next week",
      opened: true,
    });
  });
  it("ignores /next inside a word", () => {
    expect(detectNextTyped("a/nex", "a/next").opened).toBe(false);
  });
});

describe("dues step", () => {
  const fetched: NextCollectionItem[] = [
    { id: "s1", due_date: "2026-10-22", amount: 2100, type: "loan" },
    { id: "s2", due_date: "2026-11-05", amount: 2100, type: "loan" },
    { id: "s3", due_date: "2026-10-25", amount: 750, type: "cash_advance" },
    {
      id: "r1",
      due_date: "2026-10-30",
      amount: 2500,
      type: "cash_advance",
      manual: true,
    },
  ];
  const dayItems = [
    item(
      "i1",
      buildDueLabel({
        borrower_id: "x",
        name: "x",
        items: [due("s3", "2026-10-25", 750, "cash_advance")],
      }),
    ),
    item("i2", "[nora](/borrowers/n1) plain note"),
  ];

  it("leaves out dues already on the day's list and saved payments", () => {
    const listed = listedScheduleIds(dayItems);
    expect([...listed]).toEqual(["s3"]);
    const lines: DraftLine[] = [
      { ...due("r1", "2026-10-30", 500), paid: true },
    ];
    const { offered, alreadyListed } = offerDues(fetched, listed, lines);
    expect(offered.map((o) => o.id)).toEqual(["s1", "s2"]);
    expect(alreadyListed).toBe(1);
  });

  it("offers the edited item's own dues again", () => {
    const listed = listedScheduleIds(dayItems, "i1");
    expect(offerDues(fetched, listed, []).offered.map((o) => o.id)).toContain(
      "s3",
    );
  });

  it("picks become lines; lines the step didn't offer stay", () => {
    const { offered } = offerDues(fetched, new Set(), []);
    const kept: DraftLine = { ...due("p1", DAY, 500), paid: true };
    const old = due("gone", "2026-10-01", 900);
    const lines = [kept, old, due("s2", "2026-11-05", 2100)];
    const sel = initialSelection(offered, lines);
    expect([...sel]).toEqual(["s2"]);
    sel.add("s1");
    const next = applyDuesSelection(lines, offered, sel);
    expect(next.map((l) => l.id)).toEqual(["p1", "gone", "s1", "s2"]);
    expect(duesStepButton(lines, offered, sel)).toEqual({
      label: "Add 2 · ₱4,200",
      enabled: true,
    });
    expect(duesStepButton(lines, offered, new Set())).toEqual({
      label: "Remove picked dues",
      enabled: true,
    });
    expect(duesStepButton([], offered, new Set()).enabled).toBe(false);
  });

  it("chips read like the prototype", () => {
    expect(chipText(due("s1", "2026-10-22", 2100))).toBe(
      "oct 22 · Loan · ₱2,100",
    );
    expect(
      chipText({ ...due("p", DAY, 500, "cash_advance"), paid: true }),
    ).toBe("CA · ₱500 paid");
  });
});

describe("submitPlan: collect", () => {
  it("is disabled when empty", () => {
    expect(submitPlan(base)).toEqual({ ok: false, reason: "empty" });
    expect(submitPlan({ ...base, text: "   " }).ok).toBe(false);
  });

  it("free text with no dues is a plain note", () => {
    const plan = submitPlan({ ...base, text: " call the office " });
    expect(plan).toEqual({
      ok: true,
      action: "add",
      label: "call the office",
      categoryId: "c-collect",
      checked: false,
    });
  });

  it("two mentions then two dues: one collection row for the last borrower", () => {
    const lines = [
      due("s1", "2026-10-22", 2100),
      due("s2", "2026-11-05", 2100),
    ];
    const plan = submitPlan({
      ...base,
      mentions: [dante, nora],
      lines,
      text: "promised friday",
    });
    if (!plan.ok || plan.action !== "add") throw new Error("expected add");
    expect(plan.checked).toBe(false);
    // Renders in the new screen...
    const row = buildRowView(item("new", plan.label));
    expect(row.model?.borrower).toEqual(nora);
    expect(row.lines.map((l) => l.id)).toEqual(["s1", "s2"]);
    expect(row.total).toBe(4200);
    expect(row.left).toBe(4200);
    expect(row.model?.note).toContain("promised friday");
    // ...and in the old one (same parser the old widget uses).
    expect(collectionRowModel(plan.label, DAY)?.lines).toHaveLength(2);
    // Same block the old `/next` dropdown writes.
    expect(plan.label.split("\n").slice(0, 4).join("\n")).toBe(
      buildDueLabel({
        borrower_id: "n1",
        name: "nora villanueva",
        items: lines,
      }),
    );
    expect(plan.label.endsWith("with [dante uy](/borrowers/d1)")).toBe(true);
  });

  it("a row of saved payments goes in ticked and shows paid", () => {
    const lines: DraftLine[] = [
      { ...due("r1", DAY, 500, "cash_advance"), paid: true },
    ];
    const plan = submitPlan({ ...base, mentions: [nora], lines });
    if (!plan.ok || plan.action !== "add") throw new Error("expected add");
    expect(plan.checked).toBe(true);
    const row = buildRowView(item("new", plan.label, { is_checked: true }));
    expect(row.status).toBe("paid");
    expect(row.left).toBe(0);
  });

  it("a saved payment plus an open due is not ticked", () => {
    const lines: DraftLine[] = [
      { ...due("r1", DAY, 500), paid: true },
      due("s1", "2026-10-22", 2100),
    ];
    const plan = submitPlan({ ...base, mentions: [nora], lines });
    expect(plan.ok && plan.action === "add" && plan.checked).toBe(false);
  });

  it("a mention alone is a plain note about that borrower", () => {
    const plan = submitPlan({ ...base, mentions: [tess] });
    expect(plan.ok && plan.action === "add" && plan.label).toBe(
      "[tess mercado](/borrowers/t1)",
    );
  });
});

describe("release", () => {
  it("reads the typed note live", () => {
    const { label, parsed } = releaseDraft(
      nora,
      "10,000 - 10 months for 110426",
      DAY,
    );
    expect(label).toBe(
      "[nora villanueva](/borrowers/n1) 10,000 - 10 months for 110426",
    );
    expect(parsed).not.toBeNull();
    expect(releaseReadBack(parsed!)).toBe(
      "Reads as ₱10,000 loan · 10 months · first payment Nov 4, 2026",
    );
  });

  it("reads cash advances and gives", () => {
    const ca = releaseDraft(nora, "1,000- c.a. for 103026", DAY).parsed!;
    expect(releaseReadBack(ca)).toBe(
      "Reads as ₱1,000 cash advance · first payment Oct 30, 2026",
    );
    const gives = releaseDraft(
      nora,
      "5000 (2) gives for 11/15 & 11/30",
      DAY,
    ).parsed!;
    expect(releaseReadBack(gives)).toBe(
      "Reads as ₱5,000 loan · 2 gives · first payment Nov 15, 2026",
    );
  });

  it("the button waits for a borrower, a parse and the category", () => {
    const r = { ...base, mode: "release" as const };
    expect(submitPlan({ ...r, text: "10,000" })).toEqual({
      ok: false,
      reason: "no-borrower",
    });
    expect(submitPlan({ ...r, mentions: [nora], text: "soon" })).toEqual({
      ok: false,
      reason: "unparsed",
    });
    expect(
      submitPlan({ ...r, mentions: [nora], text: "10,000", releasedId: null }),
    ).toEqual({ ok: false, reason: "no-category" });
    const plan = submitPlan({
      ...r,
      mentions: [nora],
      text: "10,000 - 10 months for 110426",
    });
    if (!plan.ok || plan.action !== "add") throw new Error("expected add");
    expect(plan.categoryId).toBe("c-released");
    expect(plan.checked).toBe(false);
    // The release row the list builds from it.
    const view = buildReleaseView(
      item("r", plan.label, { category_id: "c-released" }),
    );
    expect(view.name).toBe("nora villanueva");
    expect(view.typed).toBe("nora villanueva 10,000 - 10 months for 110426");
    expect(view.parsed?.initialValues.principal_amount).toBe(10000);
    expect(view.created).toBe(false);
  });

  it("a release line typed in the old screen parses the same", () => {
    const old =
      "[nora villanueva](/borrowers/n1) 10,000 - 10 months for 110426";
    expect(parseReleasedLabel(old, DAY)).toEqual(
      releaseDraft(nora, "10,000 - 10 months for 110426", DAY).parsed,
    );
  });
});

describe("submitPlan: edit", () => {
  const lines = [due("s1", "2026-10-22", 2100), due("s2", "2026-11-05", 2100)];
  const label = composeLabel({
    borrower: nora,
    others: [dante],
    lines,
    note: "promised",
  });
  const edit = { ...base, editOf: label };

  it("pre-fills from the label", () => {
    expect(labelParts(label, DAY)).toEqual({
      borrower: nora,
      lines,
      note: "promised",
    });
  });

  it("needs a line and a change", () => {
    expect(submitPlan({ ...edit, lines: [], text: "promised" })).toEqual({
      ok: false,
      reason: "no-lines",
    });
    expect(submitPlan({ ...edit, lines, text: "promised" })).toEqual({
      ok: false,
      reason: "unchanged",
    });
  });

  it("keeps the borrower and `with` mentions while changing lines and note", () => {
    const plan = submitPlan({ ...edit, lines: [lines[1]], text: "next week" });
    if (!plan.ok || plan.action !== "edit") throw new Error("expected edit");
    expect(plan.label).toBe(
      composeLabel({
        borrower: nora,
        others: [dante],
        lines: [lines[1]],
        note: "next week",
      }),
    );
    const row = buildRowView(item("e", plan.label));
    expect(row.lines.map((l) => l.id)).toEqual(["s2"]);
    expect(row.model?.note).toBe("next week\nwith [dante uy](/borrowers/d1)");
  });

  it("edits an item the old `/next` dropdown wrote", () => {
    const old = rewriteNextBlock(
      "[nora villanueva](/borrowers/n1) call first /next",
      lines,
    );
    const parts = labelParts(old, DAY);
    expect(parts.borrower).toEqual(nora);
    expect(parts.lines).toEqual(lines);
    expect(parts.note).toBe("call first");
    const plan = submitPlan({
      ...base,
      editOf: old,
      lines: parts.lines,
      text: "call later",
    });
    if (!plan.ok || plan.action !== "edit") throw new Error("expected edit");
    expect(labelParts(plan.label, DAY)).toEqual({
      ...parts,
      note: "call later",
    });
  });
});

describe("manual payments", () => {
  const flat: ManualAccount = {
    id: "acc1",
    type: "loan",
    paid: 4000,
    remaining: 8000,
    release_date: "2026-09-01",
  };
  const rolling: ManualAccount = {
    id: "acc2",
    type: "cash_advance",
    paid: 0,
    remaining: 2500,
    release_date: null,
    rolling: {
      interestRate: 10,
      open: { id: "r1", due_date: "2026-10-30", amount: 2500 },
    },
  };

  it("quick amounts end with the full amount", () => {
    expect(manualQuickAmounts(flat)).toEqual([500, 1000, 2000, 8000]);
    expect(manualQuickAmounts({ ...flat, remaining: 1500 })).toEqual([
      500, 1000, 1500,
    ]);
    expect(manualQuickAmounts({ ...flat, remaining: 0 })).toEqual([]);
  });

  it("reads 1,500 as fifteen hundred", () => {
    const c = manualPaymentCheck(flat, "1,500");
    expect(c.amount).toBe(1500);
    expect(c.canSave).toBe(true);
    expect(c.error).toBeNull();
  });

  it("refuses non-numbers, zero and more than is left", () => {
    expect(manualPaymentCheck(flat, "").canSave).toBe(false);
    expect(manualPaymentCheck(flat, "").error).toBeNull();
    expect(manualPaymentCheck(flat, "abc").error).toBe("Not a number");
    expect(manualPaymentCheck(flat, "0").canSave).toBe(false);
    expect(manualPaymentCheck(flat, "-5").canSave).toBe(false);
    expect(manualPaymentCheck(flat, "8000.004").canSave).toBe(true);
    const over = manualPaymentCheck(flat, "8000.01");
    expect(over.canSave).toBe(false);
    expect(over.error).toBe("That's more than the ₱8,000 left");
  });

  it("a rolling payment can't pass the open schedule and shows the rollover", () => {
    const part = manualPaymentCheck(rolling, "1000");
    expect(part.rollover).toBe(1500);
    expect(part.nextDue).toBe(1650);
    expect(part.hint).toBe("₱1,500 rolls over to ₱1,650 (+10%)");
    expect(manualPaidMessage(1000, part.rollover, part.nextDue)).toBe(
      "₱1,000 paid · ₱1,650 rolls over",
    );
    expect(manualPaymentCheck(rolling, "2500").hint).toBe(
      "Clears the Oct 30 schedule",
    );
    expect(manualPaymentCheck(rolling, "2600").error).toBe(
      "At most ₱2,500, the amount due on Oct 30",
    );
    expect(manualPaidMessage(500, 0, 0)).toBe("₱500 payment recorded");
  });

  it("a saved payment becomes a paid line", () => {
    expect(
      paidLine({
        id: "r1",
        due_date: "2026-10-30T00:00:00",
        amount: 1000,
        type: "cash_advance",
      }),
    ).toEqual({
      id: "r1",
      due_date: "2026-10-30",
      amount: 1000,
      type: "cash_advance",
      paid: true,
    });
  });

  it("a failed payment says nothing was recorded", () => {
    expect(manualFailureMessage("Couldn't add the payment (offline?)")).toBe(
      "Couldn't add the payment (offline?) — no payment was recorded",
    );
    expect(manualFailureMessage("Couldn't add the payment.")).toBe(
      "Couldn't add the payment — no payment was recorded",
    );
  });
});
