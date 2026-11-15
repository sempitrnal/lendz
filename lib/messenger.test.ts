import { describe, expect, it } from "vitest";
import {
  cleanMessengerUsername,
  isIOS,
  messengerAppLink,
  messengerLink,
} from "@/lib/messenger";

describe("cleanMessengerUsername", () => {
  it.each([
    ["juan.dc", "juan.dc"],
    ["  @juan.dc ", "juan.dc"],
    ["m.me/juan.dc", "juan.dc"],
    ["https://www.facebook.com/juan.dc/", "juan.dc"],
    ["https://m.facebook.com/juan.dc?ref=x", "juan.dc"],
  ])("%j → %j", (input, expected) => {
    expect(cleanMessengerUsername(input)).toBe(expected);
  });
  it.each(["", "   ", "@", "juan dc!", null, undefined])(
    "gives null for %j",
    (input) => {
      expect(cleanMessengerUsername(input)).toBeNull();
    },
  );
});

describe("messengerLink", () => {
  it("opens m.me with the username", () => {
    expect(messengerLink("juan.dc")).toBe("https://m.me/juan.dc");
  });
});

describe("messengerAppLink", () => {
  it("asks the Messenger app for the chat", () => {
    expect(messengerAppLink("juan.dc")).toBe(
      "fb-messenger://user-thread/juan.dc",
    );
  });
});

describe("isIOS", () => {
  it("knows iPhones and touch iPads, not Macs or Android", () => {
    expect(
      isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"),
    ).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(
      true,
    );
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(
      false,
    );
    expect(isIOS("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
});
