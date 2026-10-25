import { describe, expect, it } from "vitest";
import { groupColorStyle, isLightColor } from "@/lib/checklist/group-color";

describe("isLightColor", () => {
  it("is true for white and near-white", () => {
    for (const c of ["#fff", "#FFFFFF", "#fafafa", "white", "#f8fafc"]) {
      expect(isLightColor(c)).toBe(true);
    }
  });
  it("is false for real colours, and for anything it can't read", () => {
    for (const c of ["#0ea5e9", "#f59e0b", "#000", "tomato", "", null]) {
      expect(isLightColor(c)).toBe(false);
    }
  });
});

describe("groupColorStyle", () => {
  it("sets the group colour, and a gray pill border for a light one", () => {
    expect(groupColorStyle("#0ea5e9")).toEqual({ "--grp": "#0ea5e9" });
    expect(groupColorStyle("#ffffff")).toEqual({
      "--grp": "#ffffff",
      "--grp-border": "#9ca3af",
    });
  });
  it("is undefined without a colour", () => {
    expect(groupColorStyle(null)).toBeUndefined();
  });
});
