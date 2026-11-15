import { describe, expect, it } from "vitest";
import { cleanMessengerUsername, messengerLink } from "@/lib/messenger";

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
