import { beforeEach, describe, expect, it } from "vitest";
import { REVEAL_SECONDS } from "@buzzline/shared";
import { deck } from "./deck.js";
import { FakeClock } from "./fakeClock.js";
import { Game } from "./game.js";

const REVEAL_MS = REVEAL_SECONDS * 1000;

let clock: FakeClock;
let game: Game;

function setup(autoAdvance?: boolean): string {
  const r = game.join("Ann");
  if (!r.ok) throw new Error(r.error);
  game.start(autoAdvance);
  return r.playerId;
}
/** Answer the current question so the game moves to reveal. */
function toReveal(id: string): void {
  game.answer(id, deck[game.state().questionIndex]!.correctIndex);
}

beforeEach(() => {
  clock = new FakeClock();
  game = new Game("ABCD", deck, clock, () => {});
});

describe("auto-advance", () => {
  it("is off by default and the choice is in the state", () => {
    expect(game.state().autoAdvance).toBe(false);
    setup(true);
    expect(game.state().autoAdvance).toBe(true);
  });

  it("sets nextAt only during the reveal", () => {
    const id = setup(true);
    expect(game.state().nextAt).toBeNull();
    toReveal(id);
    expect(game.state().nextAt).toBe(clock.now() + REVEAL_MS);
    clock.advance(REVEAL_MS);
    expect(game.state().phase).toBe("question");
    expect(game.state().nextAt).toBeNull();
  });

  it("advances to the next question after 5 seconds", () => {
    const id = setup(true);
    toReveal(id);
    clock.advance(REVEAL_MS - 1);
    expect(game.state().phase).toBe("reveal");
    clock.advance(1);
    expect(game.state().phase).toBe("question");
    expect(game.state().questionIndex).toBe(1);
  });

  it("goes to finished after the last question", () => {
    const id = setup(true);
    for (let i = 0; i < deck.length; i++) {
      expect(game.state().questionIndex).toBe(i);
      toReveal(id);
      clock.advance(REVEAL_MS);
    }
    expect(game.state().phase).toBe("finished");
    expect(game.state().nextAt).toBeNull();
    clock.advance(60_000);
    expect(game.state().phase).toBe("finished");
  });

  it("host:next skips the pause and the old timer does not advance a second time", () => {
    const id = setup(true);
    toReveal(id);
    clock.advance(2000);
    expect(game.next()).toEqual({ ok: true });
    expect(game.state().questionIndex).toBe(1);
    // The skipped timer would have fired here.
    clock.advance(REVEAL_MS - 2000);
    expect(game.state().questionIndex).toBe(1);
    expect(game.state().phase).toBe("question");
    // Question 1 reveals, then its own pause advances exactly once.
    toReveal(id);
    clock.advance(REVEAL_MS);
    expect(game.state().questionIndex).toBe(2);
  });

  it("a skipped timer cannot cut the next reveal short", () => {
    const id = setup(true);
    toReveal(id);
    clock.advance(2000);
    game.next();
    toReveal(id); // question 1 reveals before the old timer would have fired
    clock.advance(REVEAL_MS - 2000); // the old timer's moment
    expect(game.state().phase).toBe("reveal");
    expect(game.state().questionIndex).toBe(1);
    clock.advance(2000); // question 1's own pause ends
    expect(game.state().questionIndex).toBe(2);
  });

  it("leaves no timer armed after a skip, the last skip, or the host leaving", () => {
    const id = setup(true);
    toReveal(id);
    expect(clock.pending).toBe(1); // the reveal timer
    game.next();
    expect(clock.pending).toBe(1); // only question 1's own timer
    for (let i = 1; i < deck.length; i++) {
      toReveal(id);
      if (i < deck.length - 1) game.next();
    }
    game.next(); // skip the last reveal
    expect(game.state().phase).toBe("finished");
    expect(clock.pending).toBe(0);
  });

  it("leaves no timer armed when the host leaves during the pause", () => {
    const id = setup(true);
    toReveal(id);
    expect(clock.pending).toBe(1);
    game.hostLeft();
    expect(clock.pending).toBe(0);
  });

  it("a skip on the last question finishes once and cancels the timer", () => {
    const id = setup(true);
    for (let i = 0; i < deck.length - 1; i++) {
      toReveal(id);
      clock.advance(REVEAL_MS);
    }
    toReveal(id);
    game.next();
    expect(game.state().phase).toBe("finished");
    clock.advance(REVEAL_MS * 2);
    expect(game.state().phase).toBe("finished");
  });

  it("a host leaving during the pause cancels the timer", () => {
    const id = setup(true);
    toReveal(id);
    game.hostLeft();
    clock.advance(REVEAL_MS * 2);
    expect(game.state().phase).toBe("finished");
    expect(game.state().nextAt).toBeNull();
  });

  it("does nothing by itself when off", () => {
    const id = setup(false);
    toReveal(id);
    expect(game.state().nextAt).toBeNull();
    clock.advance(REVEAL_MS * 10);
    expect(game.state().phase).toBe("reveal");
    expect(game.state().questionIndex).toBe(0);
  });
});
