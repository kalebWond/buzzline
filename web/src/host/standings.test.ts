import type { PlayerView } from "@buzzline/shared";
import { fixtures } from "@buzzline/shared/fixtures";
import { describe, expect, it } from "vitest";
import { snapshot, standings } from "./standings";

const p = (id: string, score: number): PlayerView => ({ id, name: id, score, answered: false, streak: 0 });

describe("snapshot", () => {
  it("records score and shared ranks", () => {
    expect(snapshot([p("a", 100), p("b", 100), p("c", 50)])).toEqual({
      a: { score: 100, rank: 1 },
      b: { score: 100, rank: 1 },
      c: { score: 50, rank: 3 },
    });
  });
});

describe("standings", () => {
  it("shows points gained and places moved", () => {
    const before = snapshot([p("a", 500), p("b", 300), p("c", 0)]);
    const out = standings([p("b", 1100), p("a", 500), p("c", 900)], before);
    expect(out.map((s) => [s.player.id, s.rank, s.gained, s.moved])).toEqual([
      ["b", 1, 800, 1],
      ["c", 2, 900, 1],
      ["a", 3, 0, -2],
    ]);
  });
  it("shows no moves when everyone was tied before, as at the first question", () => {
    const before = snapshot([p("a", 0), p("b", 0), p("c", 0)]);
    const out = standings([p("a", 0), p("b", 800), p("c", 0)], before);
    expect(out.map((s) => [s.player.id, s.gained, s.moved])).toEqual([
      ["b", 800, 0],
      ["a", 0, 0],
      ["c", 0, 0],
    ]);
  });
  it("gives zeros without a snapshot or for unknown players", () => {
    const out = standings(fixtures.reveal.players, null);
    expect(out.map((s) => [s.gained, s.moved])).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(standings([p("new", 10)], snapshot([p("old", 5)]))[0]).toMatchObject({ gained: 0, moved: 0 });
  });
  it("sorts high to low, keeps input order on ties, and does not mutate", () => {
    const input = [p("a", 1), p("b", 5), p("c", 5)];
    expect(standings(input, null).map((s) => [s.player.id, s.rank])).toEqual([
      ["b", 1],
      ["c", 1],
      ["a", 3],
    ]);
    expect(input.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
