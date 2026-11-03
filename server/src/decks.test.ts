import type http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { DECKS, DEFAULT_DECK_ID, type ServerMessage } from "@buzzline/shared";
import { createServer } from "./app.js";
import { decks } from "./deck.js";
import { FakeClock } from "./fakeClock.js";
import { attachWebSocket } from "./ws.js";

describe("deck validity", () => {
  it("has a deck for every DECKS entry", () => {
    expect(Object.keys(decks).sort()).toEqual(DECKS.map((d) => d.id).sort());
  });
  for (const d of DECKS) {
    it(`${d.id} has 5 questions with 4 choices and valid correct index`, () => {
      const deck = decks[d.id]!;
      expect(deck).toHaveLength(5);
      for (const q of deck) {
        expect(q.choices).toHaveLength(4);
        expect(Number.isInteger(q.correctIndex)).toBe(true);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
      }
    });
  }
  it("science and geography vary the correct position", () => {
    for (const id of ["science", "geography"]) {
      expect(new Set(decks[id]!.map((q) => q.correctIndex)).size).toBeGreaterThan(2);
    }
  });
});

describe("host:create deckId", () => {
  let server: http.Server;
  let port: number;
  let sockets: WebSocket[] = [];

  beforeEach(async () => {
    server = createServer();
    attachWebSocket(server, { clock: new FakeClock() });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(async () => {
    for (const s of sockets) s.terminate();
    sockets = [];
    await new Promise<void>((r) => server.close(() => r()));
  });

  const opened = (s: WebSocket) =>
    new Promise((res, rej) => {
      s.on("open", res);
      s.on("error", rej);
    });
  const until = async (p: () => boolean) => {
    for (let i = 0; i < 200 && !p(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(p()).toBe(true);
  };

  /** Starts a game and returns the first question text shown to the host. */
  async function firstQuestion(deckId?: string): Promise<string> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const pl = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(ws, pl);
    const hostMsgs: ServerMessage[] = [];
    ws.on("message", (d) => hostMsgs.push(JSON.parse(d.toString())));
    await Promise.all([opened(ws), opened(pl)]);
    ws.send(JSON.stringify(deckId === undefined ? { type: "host:create" } : { type: "host:create", deckId }));
    await until(() => hostMsgs.some((m) => m.type === "welcome"));
    const w = hostMsgs.find((m) => m.type === "welcome");
    const code = w && w.type === "welcome" ? w.code : "";
    pl.send(JSON.stringify({ type: "player:join", code, name: "Ann" }));
    await until(() => hostMsgs.some((m) => m.type === "state" && m.state.players.length === 1));
    ws.send(JSON.stringify({ type: "host:start" }));
    await until(() => hostMsgs.some((m) => m.type === "state" && m.state.phase === "question"));
    expect(JSON.stringify(hostMsgs)).not.toMatch(/correctIndex":\d/);
    const q = [...hostMsgs].reverse().find((m) => m.type === "state" && m.state.question);
    return q && q.type === "state" ? q.state.question!.text : "";
  }

  for (const d of DECKS) {
    it(`uses the ${d.id} deck`, async () => {
      expect(await firstQuestion(d.id)).toBe(decks[d.id]![0]!.text);
    });
  }

  it("defaults when deckId is omitted", async () => {
    expect(await firstQuestion()).toBe(decks[DEFAULT_DECK_ID]![0]!.text);
  });

  it("rejects an unknown deckId", async () => {
    for (const bad of ["nope", 5, null]) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(ws);
      const got: ServerMessage[] = [];
      ws.on("message", (d) => got.push(JSON.parse(d.toString())));
      await opened(ws);
      ws.send(JSON.stringify({ type: "host:create", deckId: bad }));
      await until(() => got.length >= 1);
      expect(got).toEqual([{ type: "error", message: "Invalid message" }]);
    }
  });
});
