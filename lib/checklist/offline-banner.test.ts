import { describe, expect, it } from "vitest";
import { offlineBannerText } from "./offline-banner";

describe("offlineBannerText", () => {
  it("is hidden online, whatever is waiting", () => {
    expect(offlineBannerText(false, 0)).toBeNull();
    expect(offlineBannerText(false, 3)).toBeNull();
  });

  it("says saved data when offline and nothing waits", () => {
    expect(offlineBannerText(true, 0)).toBe("Offline · showing saved data");
  });

  it("singular and plural counts", () => {
    expect(offlineBannerText(true, 1)).toBe("Offline · 1 change waiting");
    expect(offlineBannerText(true, 2)).toBe("Offline · 2 changes waiting");
  });

  it("treats junk counts as nothing waiting", () => {
    expect(offlineBannerText(true, -1)).toBe("Offline · showing saved data");
    expect(offlineBannerText(true, NaN)).toBe("Offline · showing saved data");
  });
});
