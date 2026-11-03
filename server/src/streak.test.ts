import { beforeEach, describe, expect, it } from "vitest";
import { deck } from "./deck.js";
import { FakeClock } from "./fakeClock.js";
import { Game } from "./game.js";

let clock: FakeClock;
let game: Game;

function join(name: string): string {
  const r = game.join(name);
  if (!r.ok) throw new Error(r.error);
  return r.playerId;
}
const me = (id: string) => game.state().players.find((p) => p.id === id)!;
const correctIndex = (_g: Game) => deck[0]!.correctIndex;

/** Long deck so a streak of 6 fits. Every question has the same answer. */
const longDeck = Array.from({ length: 7 }, () => deck[0]!);

beforeEach(() => {
  clock = new FakeClock();
  game = new Game("ABCD", longDeck, clock, () => {});
});

/** Plays one question as a lone player, answering instantly. Returns points gained. */
function round(id: string, right: boolean): number {
  const before = me(id).score;
  game.answer(id, right ? correctIndex(game) : (correctIndex(game) + 1) % 4);
  expect(game.state().phase).toBe("reveal");
  return me(id).score - before;
}

describe("streaks", () => {
  it("starts at 0, counts correct answers, resets on a wrong one", () => {
    const a = join("Ada");
    game.start();
    expect(me(a).streak).toBe(0);
    round(a, true);
    expect(me(a).streak).toBe(1);
    game.next();
    round(a, true);
    expect(me(a).streak).toBe(2);
    game.next();
    round(a, false);
    expect(me(a).streak).toBe(0);
  });

  it("adds the bonus at 3, resets on a miss, and adds it again at 6", () => {
    const a = join("Ada");
    game.start();
    const pattern = [true, true, true, false, true, true, true];
    const gains: number[] = [];
    pattern.forEach((right, i) => {
      if (i > 0) game.next();
      gains.push(round(a, right));
    });
    // A correct answer with the full 20 seconds left is worth 1000.
    expect(gains).toEqual([1000, 1000, 1200, 0, 1000, 1000, 1200]);
    expect(me(a).streak).toBe(3);
  });

  it("gives a second bonus at 6 in a row", () => {
    const a = join("Ada");
    game.start();
    const gains: number[] = [];
    for (let i = 0; i < 6; i++) {
      if (i > 0) game.next();
      gains.push(round(a, true));
    }
    expect(gains).toEqual([1000, 1000, 1200, 1000, 1000, 1200]);
    expect(me(a).streak).toBe(6);
  });

  it("resets on a missing answer, and changes only at reveal", () => {
    const a = join("Ada");
    const b = join("Bob");
    game.start();
    game.answer(a, correctIndex(game));
    game.answer(b, correctIndex(game));
    game.next();
    game.answer(a, correctIndex(game));
    expect(me(a).streak).toBe(1); // still in the question phase
    clock.advance(20_000); // Bob never answers
    expect(game.state().phase).toBe("reveal");
    expect(me(a).streak).toBe(2);
    expect(me(b).streak).toBe(0);
  });
});
