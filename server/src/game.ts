import { randomUUID } from "node:crypto";
import { QUESTION_SECONDS, REVEAL_SECONDS, STREAK_BONUS, STREAK_LENGTH, type GameState, type Phase, type PlayerView } from "@buzzline/shared";
import type { DeckQuestion } from "./deck.js";

export interface Clock {
  now(): number;
  /** Schedules fn after ms. Returns a function that cancels it. */
  setTimeout(fn: () => void, ms: number): () => void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

/** Error messages from the contract, highest priority first. */
export const ERROR_ORDER = [
  "Invalid message",
  "Game not found",
  "Player not found",
  "Game already started",
  "Not allowed now",
  "Need at least 1 player",
  "Name must be 1 to 20 characters",
  "Name taken",
] as const;
export type GameError = (typeof ERROR_ORDER)[number];

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: GameError };

interface Player {
  id: string;
  name: string;
  score: number;
  answered: boolean;
  streak: number;
  pending: number;
  choice: number | null;
}

const QUESTION_MS = QUESTION_SECONDS * 1000;
const REVEAL_MS = REVEAL_SECONDS * 1000;

/**
 * Game rules only. No networking. `onChange` fires after a change caused by
 * start, next, answer, a timer, a lobby leave or the host leaving. join() and
 * rejoin() do not fire it: the caller sends welcome first, then announces.
 */
export class Game {
  private phase: Phase = "lobby";
  private players: Player[] = [];
  private questionIndex = 0;
  private deadline: number | null = null;
  private autoAdvance = false;
  private nextAt: number | null = null;
  private cancelTimer: (() => void) | null = null;

  constructor(
    readonly code: string,
    private readonly deck: DeckQuestion[],
    private readonly clock: Clock,
    private readonly onChange: () => void,
  ) {}

  state(): GameState {
    const q = this.phase === "question" || this.phase === "reveal" ? this.deck[this.questionIndex] : undefined;
    const players: PlayerView[] = this.players
      .map((p) => ({ id: p.id, name: p.name, score: p.score, answered: p.answered, streak: p.streak }))
      .sort((a, b) => b.score - a.score); // stable: ties keep join order
    return {
      code: this.code,
      phase: this.phase,
      players,
      questionIndex: this.questionIndex,
      questionCount: this.deck.length,
      question: q ? { text: q.text, choices: [...q.choices] } : null,
      deadline: this.phase === "question" ? this.deadline : null,
      correctIndex: this.phase === "reveal" && q ? q.correctIndex : null,
      answerCounts: this.phase === "reveal" && q ? this.countAnswers(q.choices.length) : null,
      autoAdvance: this.autoAdvance,
      nextAt: this.phase === "reveal" ? this.nextAt : null,
    };
  }

  private countAnswers(n: number): number[] {
    const counts = new Array<number>(n).fill(0);
    for (const p of this.players) {
      if (p.choice !== null && p.choice >= 0 && p.choice < n) counts[p.choice]!++;
    }
    return counts;
  }

  checkJoin(rawName: string): GameError | null {
    if (this.phase !== "lobby") return "Game already started";
    const name = rawName.trim();
    if (name.length < 1 || name.length > 20) return "Name must be 1 to 20 characters";
    if (this.players.some((p) => p.name === name)) return "Name taken";
    return null;
  }

  join(rawName: string): Result<{ playerId: string }> {
    const error = this.checkJoin(rawName);
    if (error) return { ok: false, error };
    const player: Player = { id: randomUUID(), name: rawName.trim(), score: 0, answered: false, streak: 0, pending: 0, choice: null };
    this.players.push(player);
    return { ok: true, playerId: player.id };
  }

  checkRejoin(playerId: string): GameError | null {
    if (!this.players.some((p) => p.id === playerId)) return "Player not found";
    if (this.phase === "lobby") return "Not allowed now";
    return null;
  }

  /** Why host:kick cannot remove this player, ignoring who sent it. */
  checkKick(playerId: string): GameError | null {
    if (!this.players.some((p) => p.id === playerId)) return "Player not found";
    if (this.phase !== "lobby") return "Not allowed now";
    return null;
  }

  /** The host removes a lobby player. Fires onChange. */
  kick(playerId: string): Result {
    const error = this.checkKick(playerId);
    if (error) return { ok: false, error };
    this.removePlayer(playerId);
    return { ok: true };
  }

  /** A player's socket closed. Only lobby players are removed. */
  removePlayer(playerId: string): void {
    if (this.phase !== "lobby") return;
    const before = this.players.length;
    this.players = this.players.filter((p) => p.id !== playerId);
    if (this.players.length !== before) this.onChange();
  }

  /** The host's socket closed. */
  hostLeft(): void {
    if (this.phase === "finished") return;
    this.cancel();
    this.deadline = null;
    this.nextAt = null;
    this.phase = "finished";
    this.onChange();
  }

  start(autoAdvance = false): Result {
    if (this.phase !== "lobby") return { ok: false, error: "Not allowed now" };
    if (this.players.length < 1) return { ok: false, error: "Need at least 1 player" };
    this.autoAdvance = autoAdvance;
    this.beginQuestion(0);
    return { ok: true };
  }

  next(): Result {
    if (this.phase !== "reveal") return { ok: false, error: "Not allowed now" };
    this.cancel(); // a skip must disarm the auto-advance timer
    this.nextAt = null;
    if (this.questionIndex + 1 >= this.deck.length) {
      this.phase = "finished";
      this.onChange();
    } else {
      this.beginQuestion(this.questionIndex + 1);
    }
    return { ok: true };
  }

  answer(playerId: string, choice: number): Result {
    if (this.phase !== "question") return { ok: false, error: "Not allowed now" };
    const player = this.players.find((p) => p.id === playerId);
    const now = this.clock.now();
    // Second and late answers are ignored without an error.
    if (!player || player.answered || this.deadline === null || now >= this.deadline) return { ok: true };
    const q = this.deck[this.questionIndex]!;
    player.answered = true;
    player.choice = choice;
    if (choice === q.correctIndex) {
      player.pending = 500 + Math.round((500 * (this.deadline - now)) / QUESTION_MS);
    }
    if (this.players.every((p) => p.answered)) this.reveal();
    else this.onChange();
    return { ok: true };
  }

  private beginQuestion(index: number): void {
    this.questionIndex = index;
    this.phase = "question";
    for (const p of this.players) {
      p.answered = false;
      p.pending = 0;
      p.choice = null;
    }
    this.deadline = this.clock.now() + QUESTION_MS;
    this.cancelTimer = this.clock.setTimeout(() => this.reveal(), QUESTION_MS);
    this.onChange();
  }

  private reveal(): void {
    if (this.phase !== "question") return;
    this.cancel();
    for (const p of this.players) {
      p.score += p.pending;
      if (p.pending > 0) {
        p.streak += 1;
        if (p.streak % STREAK_LENGTH === 0) p.score += STREAK_BONUS;
      } else {
        p.streak = 0;
      }
      p.pending = 0;
    }
    this.deadline = null;
    this.phase = "reveal";
    if (this.autoAdvance) {
      this.nextAt = this.clock.now() + REVEAL_MS;
      this.cancelTimer = this.clock.setTimeout(() => this.next(), REVEAL_MS);
    }
    this.onChange();
  }

  private cancel(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }
}
