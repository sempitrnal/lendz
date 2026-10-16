import { describe, expect, it } from "vitest";
import {
  classifyProbe,
  INITIAL_CONNECTION_STATE,
  nextConnectionState,
  type ConnectionQuality,
  type ConnectionState,
} from "@/lib/offline/connection";

const ok = (ms: number) => ({ ok: true, ms, timedOut: false });

describe("classifyProbe", () => {
  it("is good for a fast probe and slow for a slow one", () => {
    expect(classifyProbe("good", ok(300))).toBe("good");
    expect(classifyProbe("good", ok(2000))).toBe("slow");
  });

  it("needs a clearly better probe to leave slow than it took to enter", () => {
    expect(classifyProbe("good", ok(1200))).toBe("good");
    expect(classifyProbe("slow", ok(1200))).toBe("slow");
    expect(classifyProbe("slow", ok(600))).toBe("good");
  });

  it("calls a timeout slow and a fast failure offline", () => {
    expect(classifyProbe("good", { ok: false, ms: 4000, timedOut: true })).toBe(
      "slow",
    );
    expect(classifyProbe("good", { ok: false, ms: 20, timedOut: false })).toBe(
      "offline",
    );
  });

  it("trusts the browser when it says it is offline, and 2g links", () => {
    expect(classifyProbe("good", ok(100), { onLine: false })).toBe("offline");
    expect(classifyProbe("good", ok(100), { effectiveType: "2g" })).toBe(
      "slow",
    );
  });
});

describe("nextConnectionState", () => {
  const feed = (readings: ConnectionQuality[]) =>
    readings.reduce<ConnectionState>(
      (s, r) => nextConnectionState(s, r),
      INITIAL_CONNECTION_STATE,
    );

  it("ignores a single odd reading", () => {
    expect(feed(["slow"]).quality).toBe("good");
    expect(feed(["slow", "good"]).quality).toBe("good");
  });

  it("switches after two in a row", () => {
    expect(feed(["slow", "slow"]).quality).toBe("slow");
  });

  it("restarts the count when the readings disagree", () => {
    expect(feed(["slow", "offline", "slow"]).quality).toBe("good");
    expect(feed(["slow", "offline", "offline"]).quality).toBe("offline");
  });

  it("switches at once when told to", () => {
    expect(
      nextConnectionState(INITIAL_CONNECTION_STATE, "offline", {
        immediate: true,
      }).quality,
    ).toBe("offline");
  });
});
