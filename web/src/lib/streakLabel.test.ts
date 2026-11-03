import { describe, expect, it } from "vitest";
import { streakLabel } from "./streakLabel";

describe("streakLabel", () => {
  it("is empty at 0", () => expect(streakLabel(0)).toBe(""));
  it("shows the count", () => expect(streakLabel(3)).toBe("🔥 3"));
});
