import { describe, expect, it } from "vitest";
import { createLoadSequence } from "@/lib/checklist/load-sequence";

describe("createLoadSequence", () => {
  it("only the latest load is current", () => {
    const seq = createLoadSequence();
    const a = seq.next();
    const b = seq.next();
    expect(seq.isCurrent(a)).toBe(false);
    expect(seq.isCurrent(b)).toBe(true);
  });
});
