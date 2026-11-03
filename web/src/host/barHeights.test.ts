import { fixtures } from "@buzzline/shared/fixtures";
import { describe, expect, it } from "vitest";
import { barPercents } from "./barHeights";

describe("barPercents", () => {
  it("scales to the largest count", () => {
    expect(barPercents([1, 2, 4, 0])).toEqual([25, 50, 100, 0]);
  });
  it("gives zeros when nobody answered", () => {
    expect(barPercents([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });
  it("handles empty input and the reveal fixture", () => {
    expect(barPercents([])).toEqual([]);
    expect(barPercents(fixtures.reveal.answerCounts!)).toEqual([0, 100, 0, 100]);
  });
});
