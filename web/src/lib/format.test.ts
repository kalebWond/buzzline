import { describe, expect, it } from "vitest";
import { avatarHue, choiceLetter, formatScore, initials, joinUrl, ordinal, secondsLeft, timeFraction } from "./format";

describe("choiceLetter", () => {
  it("maps the four choices to A to D", () => {
    expect([0, 1, 2, 3].map(choiceLetter)).toEqual(["A", "B", "C", "D"]);
  });
  it("falls back to numbers past D", () => expect(choiceLetter(4)).toBe("5"));
});

describe("avatarHue", () => {
  it("is stable and in range", () => {
    expect(avatarHue("Ada")).toBe(avatarHue("Ada"));
    for (const n of ["Ada", "Linus", "", "🦊 Fox", "Zoë"]) {
      const h = avatarHue(n);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
  it("ignores case and surrounding spaces", () => expect(avatarHue(" ada ")).toBe(avatarHue("ADA")));
  it("usually differs between names", () => expect(avatarHue("Ada")).not.toBe(avatarHue("Linus")));
});

describe("initials", () => {
  it("takes the first letter of one word", () => expect(initials("ada")).toBe("A"));
  it("takes first and last word", () => expect(initials("Grace Brewster Hopper")).toBe("GH"));
  it("keeps emoji whole", () => expect(initials("🦊 fox")).toBe("🦊F"));
  it("handles blank names", () => expect(initials("   ")).toBe("?"));
});

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [102, "102nd"],
    [111, "111th"],
  ])("%i → %s", (n, s) => expect(ordinal(n)).toBe(s));
});

describe("secondsLeft", () => {
  it("rounds up partial seconds", () => expect(secondsLeft(10_500, 0)).toBe(11));
  it("never goes below zero", () => expect(secondsLeft(1_000, 5_000)).toBe(0));
  it("never exceeds the question length, even with clock skew", () => expect(secondsLeft(60_000, 0, 20)).toBe(20));
  it("is zero with no deadline", () => expect(secondsLeft(null, 0)).toBe(0));
});

describe("timeFraction", () => {
  it("is 1 at the start and 0 at the end", () => {
    expect(timeFraction(20_000, 0, 20)).toBe(1);
    expect(timeFraction(20_000, 20_000, 20)).toBe(0);
  });
  it("is linear in between", () => expect(timeFraction(20_000, 15_000, 20)).toBe(0.25));
  it("clamps", () => {
    expect(timeFraction(99_000, 0, 20)).toBe(1);
    expect(timeFraction(0, 5_000, 20)).toBe(0);
  });
  it("is zero with no deadline", () => expect(timeFraction(null, 0)).toBe(0));
});

describe("joinUrl", () => {
  it("puts the code in the query", () => expect(joinUrl("http://10.0.0.5:5173", "ABCD")).toBe("http://10.0.0.5:5173/?code=ABCD"));
});

describe("formatScore", () => {
  it("adds separators", () => expect(formatScore(12345)).toBe("12,345"));
});
