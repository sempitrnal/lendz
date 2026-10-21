import { describe, expect, it } from "vitest";
import { createToastRegistry } from "@/lib/checklist/toast-registry";

describe("createToastRegistry", () => {
  it("hands back every registered id once", () => {
    const r = createToastRegistry();
    r.add("a");
    r.add(2);
    r.add("a");
    expect(r.takeAll()).toEqual(["a", 2]);
    expect(r.takeAll()).toEqual([]);
  });

  it("forgets toasts that closed by themselves", () => {
    const r = createToastRegistry();
    r.add("a");
    r.add("b");
    r.remove("a");
    expect(r.has("a")).toBe(false);
    expect(r.takeAll()).toEqual(["b"]);
  });

  it("never holds ids it wasn't given (error toasts stay)", () => {
    const r = createToastRegistry();
    r.add("undo-1");
    expect(r.has("error-1")).toBe(false);
    expect(r.takeAll()).not.toContain("error-1");
  });
});
