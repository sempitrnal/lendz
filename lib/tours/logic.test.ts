import { describe, expect, it } from "vitest";
import {
  markSeen,
  nextTour,
  playableSteps,
  readSeen,
  tourById,
  type Tour,
} from "@/lib/tours/logic";

const step = (target: string) => ({ target, title: "t", body: "b" });
const tour = (id: string, page: string): Tour => ({
  id,
  title: id,
  date: "2026-10-22",
  page,
  steps: [step('[data-tour="a"]')],
});

function fakeStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_: string, v: string) => {
      value = v;
    },
    read: () => value,
  };
}

describe("nextTour", () => {
  const tours = [
    tour("2026-10-01-a", "/x"),
    tour("2026-10-02-b", "/x"),
    tour("2026-10-03-c", "/y"),
  ];
  it("is the oldest unseen tour for the page", () => {
    expect(nextTour(tours, "/x", [])?.id).toBe("2026-10-01-a");
    expect(nextTour(tours, "/x", ["2026-10-01-a"])?.id).toBe("2026-10-02-b");
  });
  it("is null when all are seen or none match the page", () => {
    expect(nextTour(tours, "/x", ["2026-10-01-a", "2026-10-02-b"])).toBeNull();
    expect(nextTour(tours, "/z", [])).toBeNull();
  });
});

describe("nextTour with a manual tour", () => {
  it("never starts a tour marked auto: false by itself", () => {
    const manual = { ...tour("2026-10-01-guide", "/x"), auto: false };
    expect(nextTour([manual], "/x", [])).toBeNull();
    expect(nextTour([manual, tour("2026-10-02-b", "/x")], "/x", [])?.id).toBe(
      "2026-10-02-b",
    );
  });
});

describe("nextTour with a wildcard page", () => {
  const tours = [tour("2026-10-01-w", "/borrowers/*")];
  it("matches any path under the prefix, not the prefix itself", () => {
    expect(nextTour(tours, "/borrowers/abc", [])?.id).toBe("2026-10-01-w");
    expect(nextTour(tours, "/borrowers/abc/edit", [])?.id).toBe("2026-10-01-w");
    expect(nextTour(tours, "/borrowers", [])).toBeNull();
    expect(nextTour(tours, "/borrowersX/abc", [])).toBeNull();
  });
});

describe("tourById", () => {
  const tours = [tour("2026-10-01-a", "/x")];
  it("finds a known id", () => {
    expect(tourById(tours, "2026-10-01-a")?.id).toBe("2026-10-01-a");
  });
  it("is null for null, empty or unknown ids", () => {
    expect(tourById(tours, null)).toBeNull();
    expect(tourById(tours, "")).toBeNull();
    expect(tourById(tours, "nope")).toBeNull();
  });
});

describe("playableSteps", () => {
  it("keeps only steps whose target exists, in order", () => {
    const steps = [step("a"), step("b"), step("c")];
    expect(playableSteps(steps, (s) => s !== "b").map((s) => s.target)).toEqual(
      ["a", "c"],
    );
  });
});

describe("playableSteps with lazy steps", () => {
  it("keeps a lazy step even though its target isn't there yet", () => {
    const steps = [step("a"), { ...step("later"), lazy: true }, step("gone")];
    expect(
      playableSteps(steps, (sel) => sel === "a").map((s) => s.target),
    ).toEqual(["a", "later"]);
  });
});

describe("readSeen", () => {
  it("is empty for a missing key, bad JSON or a non-array", () => {
    expect(readSeen(fakeStorage())).toEqual([]);
    expect(readSeen(fakeStorage("{nope"))).toEqual([]);
    expect(readSeen(fakeStorage('{"a":1}'))).toEqual([]);
  });
  it("is empty when storage throws", () => {
    expect(
      readSeen({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual([]);
  });
  it("reads stored ids", () => {
    expect(readSeen(fakeStorage('["a","b"]'))).toEqual(["a", "b"]);
  });
});

describe("markSeen", () => {
  it("appends once and keeps earlier ids", () => {
    const s = fakeStorage('["a"]');
    markSeen("b", s);
    markSeen("b", s);
    expect(JSON.parse(s.read()!)).toEqual(["a", "b"]);
  });
  it("does not throw when storage throws", () => {
    expect(() =>
      markSeen("a", {
        getItem: () => null,
        setItem: () => {
          throw new Error("full");
        },
      }),
    ).not.toThrow();
  });
});

describe("storage whose getter throws", () => {
  it("reads as empty and never throws", async () => {
    const { vi } = await import("vitest");
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    try {
      expect(readSeen()).toEqual([]);
      expect(() => markSeen("a")).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
