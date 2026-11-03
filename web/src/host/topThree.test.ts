import type { PlayerView } from "@buzzline/shared";
import { fixtures } from "@buzzline/shared/fixtures";
import { describe, expect, it } from "vitest";
import { topThree } from "./topThree";

const p = (id: string, score: number): PlayerView => ({ id, name: id, score, answered: false, streak: 0 });

describe("topThree", () => {
  it("returns fewer than three when few players", () => {
    expect(topThree(fixtures.finished.players).map((x) => x.id)).toEqual(["p1", "p2"]);
    expect(topThree([])).toEqual([]);
  });
  it("sorts by score and keeps the best three", () => {
    const out = topThree([p("a", 10), p("b", 50), p("c", 30), p("d", 40)]);
    expect(out.map((x) => x.id)).toEqual(["b", "d", "c"]);
  });
  it("keeps input order on ties", () => {
    expect(topThree([p("a", 5), p("b", 5), p("c", 5), p("d", 5)]).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("does not mutate input", () => {
    const input = [p("a", 1), p("b", 2)];
    topThree(input);
    expect(input.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
