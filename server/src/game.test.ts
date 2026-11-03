import { beforeEach, describe, expect, it } from "vitest";
import { deck } from "./deck.js";
import { FakeClock } from "./fakeClock.js";
import { Game } from "./game.js";

let clock: FakeClock;
let changes: number;
let game: Game;

function join(name: string): string {
  const r = game.join(name);
  if (!r.ok) throw new Error(r.error);
  return r.playerId;
}
const score = (id: string) => game.state().players.find((p) => p.id === id)!.score;
const correct = () => deck[game.state().questionIndex]!.correctIndex;
const wrong = () => (correct() + 1) % 4;

beforeEach(() => {
  clock = new FakeClock();
  changes = 0;
  game = new Game("ABCD", deck, clock, () => changes++);
});

describe("deck", () => {
  it("has five questions with four choices each", () => {
    expect(deck).toHaveLength(5);
    for (const q of deck) {
      expect(q.choices).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
    }
  });
});

describe("lobby", () => {
  it("starts empty in lobby with no question", () => {
    expect(game.state()).toEqual({
      code: "ABCD",
      phase: "lobby",
      players: [],
      questionIndex: 0,
      questionCount: 5,
      question: null,
      deadline: null,
      correctIndex: null,
      answerCounts: null,
      autoAdvance: false,
      nextAt: null,
    });
  });

  it("trims names and enforces 1 to 20 characters", () => {
    expect(game.checkJoin("   ")).toBe("Name must be 1 to 20 characters");
    expect(game.checkJoin("a".repeat(21))).toBe("Name must be 1 to 20 characters");
    expect(game.checkJoin("  " + "a".repeat(20) + "  ")).toBeNull();
    join("  Ann  ");
    expect(game.state().players[0]!.name).toBe("Ann");
  });

  it("rejects duplicate names after trimming", () => {
    join("Ann");
    expect(game.join(" Ann ")).toEqual({ ok: false, error: "Name taken" });
  });

  it("name length error outranks name taken", () => {
    expect(game.checkJoin("")).toBe("Name must be 1 to 20 characters");
  });

  it("cannot start with no players", () => {
    expect(game.start()).toEqual({ ok: false, error: "Need at least 1 player" });
    expect(game.state().phase).toBe("lobby");
  });

  it("removes a player who leaves in the lobby", () => {
    const a = join("Ann");
    join("Bob");
    changes = 0;
    game.removePlayer(a);
    expect(game.state().players.map((p) => p.name)).toEqual(["Bob"]);
    expect(changes).toBe(1);
  });

  it("rejoin is not allowed in the lobby", () => {
    const a = join("Ann");
    expect(game.checkRejoin(a)).toBe("Not allowed now");
    expect(game.checkRejoin("nope")).toBe("Player not found");
  });

  it("rejects joining after the lobby", () => {
    join("Ann");
    game.start();
    expect(game.join("Bob")).toEqual({ ok: false, error: "Game already started" });
    // Outranks name errors
    expect(game.checkJoin("")).toBe("Game already started");
  });
});

describe("question phase", () => {
  it("start sets deadline 20s ahead and shows the question without the answer", () => {
    join("Ann");
    game.start();
    const s = game.state();
    expect(s.phase).toBe("question");
    expect(s.questionIndex).toBe(0);
    expect(s.deadline).toBe(clock.now() + 20_000);
    expect(s.question).toEqual({ text: deck[0]!.text, choices: deck[0]!.choices });
    expect(s.correctIndex).toBeNull();
    expect(Object.keys(s.question!).sort()).toEqual(["choices", "text"]);
  });

  it("keeps the correct answer out of state until reveal", () => {
    const a = join("Ann");
    join("Bob");
    game.start();
    const hidden = () => {
      const s = game.state();
      expect(s.correctIndex).toBeNull();
      expect(JSON.stringify(s)).not.toContain("correct\":" + correct()); // only null allowed
    };
    hidden();
    game.answer(a, correct());
    hidden();
    clock.advance(19_999);
    hidden();
    clock.advance(1);
    expect(game.state().phase).toBe("reveal");
    expect(game.state().correctIndex).toBe(correct());
  });

  it("marks answered immediately and moves to reveal when everyone answered", () => {
    const a = join("Ann");
    const b = join("Bob");
    game.start();
    game.answer(a, 0);
    expect(game.state().players.find((p) => p.id === a)!.answered).toBe(true);
    expect(game.state().phase).toBe("question");
    game.answer(b, 0);
    expect(game.state().phase).toBe("reveal");
    expect(game.state().deadline).toBeNull();
  });

  it("ends when the 20 seconds run out", () => {
    const a = join("Ann");
    join("Bob");
    game.start();
    game.answer(a, correct());
    clock.advance(19_999);
    expect(game.state().phase).toBe("question");
    clock.advance(1);
    expect(game.state().phase).toBe("reveal");
  });

  it("early finish cancels the timer", () => {
    const a = join("Ann");
    game.start();
    game.answer(a, 0);
    changes = 0;
    clock.advance(30_000);
    expect(changes).toBe(0);
  });

  it("ignores second answers", () => {
    const a = join("Ann");
    join("Bob");
    game.start();
    game.answer(a, wrong());
    changes = 0;
    expect(game.answer(a, correct())).toEqual({ ok: true });
    expect(changes).toBe(0);
    clock.advance(20_000);
    expect(score(a)).toBe(0);
  });

  it("ignores late answers", () => {
    const a = join("Ann");
    const b = join("Bob");
    game.start();
    game.answer(b, 0);
    clock.advance(20_000); // reveal by timer
    expect(game.answer(a, correct())).toEqual({ ok: false, error: "Not allowed now" });
    expect(score(a)).toBe(0);
    expect(game.state().players.find((p) => p.id === a)!.answered).toBe(false);
  });

  it("ignores an answer at the deadline instant even if the timer has not fired", () => {
    const lagging = new FakeClock();
    lagging.setTimeout = () => () => {}; // timer never fires
    const g = new Game("WXYZ", deck, lagging, () => {});
    const r = g.join("Ann");
    if (!r.ok) throw new Error(r.error);
    g.start();
    lagging.advance(20_000);
    expect(g.answer(r.playerId, deck[0]!.correctIndex)).toEqual({ ok: true });
    expect(g.state().players[0]!.answered).toBe(false);
  });

  it("rejects answers outside the question phase", () => {
    const a = join("Ann");
    expect(game.answer(a, 0)).toEqual({ ok: false, error: "Not allowed now" });
  });
});

describe("scoring", () => {
  it("scores 1000 for an instant correct answer", () => {
    const a = join("Ann");
    join("Bob");
    game.start();
    game.answer(a, correct());
    clock.advance(20_000);
    expect(score(a)).toBe(1000);
  });

  it("scores 500 + round(500 x left / 20s)", () => {
    const a = join("Ann");
    const b = join("Bob");
    const c = join("Cy");
    join("Slow"); // never answers, so the question runs to the deadline
    game.start();
    clock.advance(5_000);
    game.answer(a, correct()); // 15s left -> 500 + 375
    clock.advance(5_000);
    game.answer(b, correct()); // 10s left -> 500 + 250
    clock.advance(9_990);
    game.answer(c, correct()); // 10ms left -> 500 + round(0.25) = 500
    expect(score(a)).toBe(0); // not before reveal
    clock.advance(10);
    expect(score(a)).toBe(875);
    expect(score(b)).toBe(750);
    expect(score(c)).toBe(500);
  });

  it("rounds to the nearest point", () => {
    const a = join("Ann");
    join("Bob");
    game.start();
    clock.advance(19_980); // 20ms left -> 0.5 rounds to 1
    game.answer(a, correct());
    clock.advance(20);
    expect(score(a)).toBe(501);
  });

  it("scores zero for a wrong answer or no answer", () => {
    const a = join("Ann");
    const b = join("Bob");
    game.start();
    game.answer(a, wrong());
    clock.advance(20_000);
    expect(score(a)).toBe(0);
    expect(score(b)).toBe(0);
  });

  it("changes scores only at reveal", () => {
    const a = join("Ann");
    const b = join("Bob");
    game.start();
    game.answer(a, correct());
    expect(score(a)).toBe(0);
    game.answer(b, wrong());
    expect(game.state().phase).toBe("reveal");
    expect(score(a)).toBe(1000);
  });

  it("accumulates and sorts players by score, high to low", () => {
    const a = join("Ann");
    const b = join("Bob");
    game.start();
    game.answer(a, wrong());
    game.answer(b, correct());
    expect(game.state().players.map((p) => p.name)).toEqual(["Bob", "Ann"]);
    game.next();
    game.answer(a, correct());
    game.answer(b, wrong());
    expect(game.state().players.map((p) => p.score)).toEqual([1000, 1000]);
  });
});

describe("progression", () => {
  it("resets answered when the next question starts but keeps it through reveal", () => {
    const a = join("Ann");
    game.start();
    game.answer(a, 0);
    expect(game.state().phase).toBe("reveal");
    expect(game.state().players[0]!.answered).toBe(true);
    game.next();
    expect(game.state().phase).toBe("question");
    expect(game.state().questionIndex).toBe(1);
    expect(game.state().players[0]!.answered).toBe(false);
    expect(game.state().deadline).toBe(clock.now() + 20_000);
  });

  it("host:next is only allowed in reveal", () => {
    join("Ann");
    expect(game.next()).toEqual({ ok: false, error: "Not allowed now" });
    game.start();
    expect(game.next()).toEqual({ ok: false, error: "Not allowed now" });
  });

  it("start is only allowed in lobby", () => {
    join("Ann");
    game.start();
    expect(game.start()).toEqual({ ok: false, error: "Not allowed now" });
  });

  it("plays five questions then finishes", () => {
    const a = join("Ann");
    game.start();
    for (let i = 0; i < 5; i++) {
      expect(game.state().questionIndex).toBe(i);
      game.answer(a, correct());
      expect(game.state().phase).toBe("reveal");
      game.next();
    }
    const s = game.state();
    expect(s.phase).toBe("finished");
    expect(s.question).toBeNull();
    expect(s.deadline).toBeNull();
    expect(s.correctIndex).toBeNull();
    expect(s.players[0]!.score).toBe(5200); // 5 x 1000 + streak bonus at 3
    expect(game.next()).toEqual({ ok: false, error: "Not allowed now" });
  });

  it("reveal state has correctIndex and no deadline", () => {
    const a = join("Ann");
    game.start();
    game.answer(a, 0);
    const s = game.state();
    expect(s.correctIndex).toBe(deck[0]!.correctIndex);
    expect(s.deadline).toBeNull();
    expect(s.question).not.toBeNull();
  });
});

describe("answerCounts", () => {
  it("is null in lobby, question and finished", () => {
    const a = join("Ann");
    expect(game.state().answerCounts).toBeNull();
    game.start();
    game.answer(a, 0);
    game.next();
    expect(game.state().answerCounts).toBeNull();
  });

  it("is null while a question is running even after some answers", () => {
    const a = join("Ann");
    join("Bob");
    game.start();
    game.answer(a, 2);
    expect(game.state().phase).toBe("question");
    expect(game.state().answerCounts).toBeNull();
  });

  it("counts one per choice and skips non-answerers", () => {
    const a = join("Ann");
    const b = join("Bob");
    join("Cy");
    game.start();
    game.answer(a, 2);
    game.answer(b, 2);
    clock.advance(20_000);
    expect(game.state().phase).toBe("reveal");
    expect(game.state().answerCounts).toEqual([0, 0, 2, 0]);
  });

  it("ignores second answers and resets for the next question", () => {
    const a = join("Ann");
    game.start();
    game.answer(a, 1);
    expect(game.state().answerCounts).toEqual([0, 1, 0, 0]);
    game.answer(a, 3);
    expect(game.state().answerCounts).toEqual([0, 1, 0, 0]);
    game.next();
    game.answer(a, 3);
    expect(game.state().answerCounts).toEqual([0, 0, 0, 1]);
  });

  it("ignores out-of-range choices", () => {
    const a = join("Ann");
    game.start();
    game.answer(a, 9);
    expect(game.state().answerCounts).toEqual([0, 0, 0, 0]);
  });
});

describe("leaving", () => {
  it("keeps players on the board after the lobby", () => {
    const a = join("Ann");
    join("Bob");
    game.start();
    changes = 0;
    game.removePlayer(a);
    expect(game.state().players).toHaveLength(2);
    expect(changes).toBe(0);
    expect(game.checkRejoin(a)).toBeNull();
  });

  it("host leaving finishes the game from any phase and stops the timer", () => {
    join("Ann");
    game.start();
    game.hostLeft();
    expect(game.state().phase).toBe("finished");
    expect(game.state().deadline).toBeNull();
    changes = 0;
    clock.advance(30_000);
    expect(changes).toBe(0);
    expect(game.state().phase).toBe("finished");
  });

  it("host leaving in the lobby finishes the game", () => {
    game.hostLeft();
    expect(game.state().phase).toBe("finished");
  });

  it("finished players can still be rejoined", () => {
    const a = join("Ann");
    game.start();
    game.hostLeft();
    expect(game.checkRejoin(a)).toBeNull();
  });
});
