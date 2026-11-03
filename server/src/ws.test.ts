import type http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { ServerMessage } from "@buzzline/shared";
import { createServer } from "./app.js";
import { deck } from "./deck.js";
import { FakeClock } from "./fakeClock.js";
import { attachWebSocket } from "./ws.js";

let server: http.Server;
let clock: FakeClock;
let port: number;
let open: Client[] = [];

class Client {
  msgs: ServerMessage[] = [];
  closed = false;
  private waiters: (() => void)[] = [];
  constructor(readonly ws: WebSocket) {
    ws.on("message", (d) => {
      this.msgs.push(JSON.parse(d.toString()));
      this.waiters.splice(0).forEach((w) => w());
    });
    ws.on("close", () => {
      this.closed = true;
      this.waiters.splice(0).forEach((w) => w());
    });
  }
  send(m: unknown): void {
    this.ws.send(typeof m === "string" ? m : JSON.stringify(m));
  }
  async until(pred: () => boolean): Promise<void> {
    while (!pred()) {
      await new Promise<void>((res, rej) => {
        this.waiters.push(res);
        setTimeout(() => rej(new Error("timeout; got " + JSON.stringify(this.msgs))), 2000);
      });
    }
  }
  /** Sends m and waits for n more messages. */
  async call(m: unknown, n = 1): Promise<ServerMessage[]> {
    const start = this.msgs.length;
    this.send(m);
    await this.until(() => this.msgs.length >= start + n);
    return this.msgs.slice(start, start + n);
  }
  last(): ServerMessage {
    return this.msgs[this.msgs.length - 1]!;
  }
  state() {
    const s = [...this.msgs].reverse().find((m) => m.type === "state");
    if (!s || s.type !== "state") throw new Error("no state");
    return s.state;
  }
}

async function connect(): Promise<Client> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const c = new Client(ws);
  open.push(c);
  await new Promise((res, rej) => {
    ws.on("open", res);
    ws.on("error", rej);
  });
  return c;
}

async function host(): Promise<{ h: Client; code: string }> {
  const h = await connect();
  const [w] = await h.call({ type: "host:create" }, 2);
  if (w!.type !== "welcome") throw new Error("no welcome");
  return { h, code: w!.code };
}

async function player(code: string, name: string): Promise<{ c: Client; id: string }> {
  const c = await connect();
  const [w] = await c.call({ type: "player:join", code, name }, 2);
  if (w!.type !== "welcome" || !w!.playerId) throw new Error("no welcome " + JSON.stringify(w));
  return { c, id: w!.playerId };
}

const err = (m: ServerMessage[] | ServerMessage) => {
  const x = Array.isArray(m) ? m[0]! : m;
  return x.type === "error" ? x.message : x.type;
};

beforeEach(async () => {
  clock = new FakeClock();
  server = createServer();
  attachWebSocket(server, { clock });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const c of open) c.ws.terminate();
  open = [];
  await new Promise<void>((r) => server.close(() => r()));
});

describe("create and join", () => {
  it("host:create sends welcome then state with a four-letter code", async () => {
    const h = await connect();
    const msgs = await h.call({ type: "host:create" }, 2);
    expect(msgs[0]).toMatchObject({ type: "welcome", role: "host", playerId: null });
    expect(msgs[0]).toMatchObject({ code: expect.stringMatching(/^[A-Z]{4}$/) });
    expect(msgs[1]!.type).toBe("state");
    expect(h.state().phase).toBe("lobby");
  });

  it("join sends welcome then state to the joiner, and state to the host", async () => {
    const { h, code } = await host();
    const before = h.msgs.length;
    const c = await connect();
    const msgs = await c.call({ type: "player:join", code: code.toLowerCase(), name: " Ann " }, 2);
    expect(msgs[0]).toMatchObject({ type: "welcome", role: "player", code });
    expect(msgs[1]!.type).toBe("state");
    await h.until(() => h.msgs.length === before + 1);
    expect(h.state().players.map((p) => p.name)).toEqual(["Ann"]);
  });

  it("removes a lobby player on disconnect and tells the host", async () => {
    const { h, code } = await host();
    const { c } = await player(code, "Ann");
    await h.until(() => h.state().players.length === 1);
    c.ws.close();
    await h.until(() => h.state().players.length === 0);
  });
});

describe("errors", () => {
  it("rejects bad JSON and bad fields", async () => {
    const c = await connect();
    expect(err(await c.call("not json"))).toBe("Invalid message");
    expect(err(await c.call({ type: "nope" }))).toBe("Invalid message");
    expect(err(await c.call({ type: "player:join", code: "ABCD" }))).toBe("Invalid message");
    expect(err(await c.call({ type: "player:join", code: 1, name: "x" }))).toBe("Invalid message");
    expect(err(await c.call({ type: "player:rejoin", code: "ABCD" }))).toBe("Invalid message");
    expect(err(await c.call({ type: "player:answer", choice: "1" }))).toBe("Invalid message");
    expect(err(await c.call({ type: "player:answer", choice: 4 }))).toBe("Invalid message");
    expect(err(await c.call({ type: "player:answer", choice: 1.5 }))).toBe("Invalid message");
    expect(err(await c.call("[]"))).toBe("Invalid message");
  });

  it("Game not found outranks name errors and Player not found", async () => {
    const c = await connect();
    expect(err(await c.call({ type: "player:join", code: "ZZZZ", name: "" }))).toBe("Game not found");
    expect(err(await c.call({ type: "player:rejoin", code: "ZZZZ", playerId: "x" }))).toBe("Game not found");
  });

  it("name errors in the lobby", async () => {
    const { code } = await host();
    const c = await connect();
    expect(err(await c.call({ type: "player:join", code, name: "  " }))).toBe("Name must be 1 to 20 characters");
    expect(err(await c.call({ type: "player:join", code, name: "x".repeat(21) }))).toBe(
      "Name must be 1 to 20 characters",
    );
    await player(code, "Ann");
    expect(err(await c.call({ type: "player:join", code, name: "Ann " }))).toBe("Name taken");
  });

  it("error goes to the sender only and leaves state unchanged", async () => {
    const { h, code } = await host();
    const { c: ann } = await player(code, "Ann");
    await h.until(() => h.state().players.length === 1);
    const hostCount = h.msgs.length;
    const annCount = ann.msgs.length;
    const c = await connect();
    await c.call({ type: "player:join", code, name: "Ann" });
    expect(h.msgs.length).toBe(hostCount);
    expect(ann.msgs.length).toBe(annCount);
  });

  it("host:start with no players, and from a player or a stranger", async () => {
    const { h, code } = await host();
    expect(err(await h.call({ type: "host:start" }))).toBe("Need at least 1 player");
    const stranger = await connect();
    expect(err(await stranger.call({ type: "host:start" }))).toBe("Not allowed now");
    const { c } = await player(code, "Ann");
    expect(err(await c.call({ type: "host:start" }))).toBe("Not allowed now");
    expect(err(await c.call({ type: "host:next" }))).toBe("Not allowed now");
    expect(err(await h.call({ type: "player:answer", choice: 0 }))).toBe("Not allowed now");
    expect(err(await h.call({ type: "host:next" }))).toBe("Not allowed now");
    expect(err(await c.call({ type: "player:answer", choice: 0 }))).toBe("Not allowed now");
  });

  it("join after start is Game already started, even with a bad name", async () => {
    const { h, code } = await host();
    await player(code, "Ann");
    await h.call({ type: "host:start" });
    const c = await connect();
    expect(err(await c.call({ type: "player:join", code, name: "Bob" }))).toBe("Game already started");
    expect(err(await c.call({ type: "player:join", code, name: "" }))).toBe("Game already started");
  });

  it("rejoin errors: unknown player, then lobby", async () => {
    const { code } = await host();
    const { id } = await player(code, "Ann");
    const c = await connect();
    expect(err(await c.call({ type: "player:rejoin", code, playerId: "nobody" }))).toBe("Player not found");
    expect(err(await c.call({ type: "player:rejoin", code, playerId: id }))).toBe("Not allowed now");
  });

  it("a socket already in a game cannot join another", async () => {
    const { code } = await host();
    const { c } = await player(code, "Ann");
    expect(err(await c.call({ type: "player:join", code, name: "Bob" }))).toBe("Not allowed now");
  });
});

describe("a full game over sockets", () => {
  it("hides the correct answer until reveal, then scores", async () => {
    const { h, code } = await host();
    const ann = await player(code, "Ann");
    const bob = await player(code, "Bob");
    await h.until(() => h.state().players.length === 2);

    await h.call({ type: "host:start" }, 1);
    await ann.c.until(() => ann.c.state().phase === "question");
    for (const c of [h, ann.c, bob.c]) {
      await c.until(() => c.state().phase === "question");
      expect(c.state().correctIndex).toBeNull();
      expect(JSON.stringify(c.msgs)).not.toMatch(/correctIndex":\d/);
    }

    clock.advance(5_000);
    const right = deck[0]!.correctIndex;
    ann.c.send({ type: "player:answer", choice: right });
    await h.until(() => h.state().players.some((p) => p.answered));
    expect(h.state().correctIndex).toBeNull();
    expect(h.state().players.every((p) => p.score === 0)).toBe(true);

    bob.c.send({ type: "player:answer", choice: (right + 1) % 4 });
    await h.until(() => h.state().phase === "reveal");
    expect(h.state().correctIndex).toBe(right);
    expect(h.state().players.map((p) => [p.name, p.score])).toEqual([
      ["Ann", 875],
      ["Bob", 0],
    ]);
  });

  it("times out by the injected clock", async () => {
    const { h, code } = await host();
    await player(code, "Ann");
    await h.call({ type: "host:start" });
    await h.until(() => h.state().phase === "question");
    clock.advance(20_000);
    await h.until(() => h.state().phase === "reveal");
  });

  it("host:next walks to finished", async () => {
    const { h, code } = await host();
    const ann = await player(code, "Ann");
    await h.call({ type: "host:start" });
    for (let i = 0; i < 5; i++) {
      await ann.c.until(() => ann.c.state().phase === "question" && ann.c.state().questionIndex === i);
      ann.c.send({ type: "player:answer", choice: deck[i]!.correctIndex });
      await ann.c.until(() => ann.c.state().phase === "reveal");
      h.send({ type: "host:next" });
    }
    await ann.c.until(() => ann.c.state().phase === "finished");
    expect(ann.c.state().players[0]!.score).toBe(5000);
  });
});

describe("rejoin and disconnect", () => {
  it("a player who drops after the lobby stays on the board and can rejoin", async () => {
    const { h, code } = await host();
    const ann = await player(code, "Ann");
    await player(code, "Bob");
    await h.call({ type: "host:start" });
    await h.until(() => h.state().phase === "question");
    const count = h.msgs.length;
    ann.c.ws.close();
    await ann.c.until(() => ann.c.closed);
    await new Promise((r) => setTimeout(r, 30));
    expect(h.msgs.length).toBe(count);
    expect(h.state().players).toHaveLength(2);

    const c2 = await connect();
    const msgs = await c2.call({ type: "player:rejoin", code: code.toLowerCase(), playerId: ann.id }, 2);
    expect(msgs[0]).toMatchObject({ type: "welcome", role: "player", playerId: ann.id, code });
    expect(msgs[1]!.type).toBe("state");
    c2.send({ type: "player:answer", choice: 0 });
    await h.until(() => h.state().players.some((p) => p.answered));
  });

  it("rejoin closes the old socket and the old close does not disturb the game", async () => {
    const { h, code } = await host();
    const ann = await player(code, "Ann");
    await h.call({ type: "host:start" });
    const c2 = await connect();
    await c2.call({ type: "player:rejoin", code, playerId: ann.id }, 2);
    await ann.c.until(() => ann.c.closed);
    c2.send({ type: "player:answer", choice: 0 });
    await h.until(() => h.state().phase === "reveal");
    expect(h.state().players).toHaveLength(1);
  });

  it("host disconnect finishes the game for everyone", async () => {
    const { h, code } = await host();
    const ann = await player(code, "Ann");
    await h.call({ type: "host:start" });
    h.ws.close();
    await ann.c.until(() => ann.c.state().phase === "finished");
  });

  it("host disconnect in the lobby finishes the game", async () => {
    const { h, code } = await host();
    const ann = await player(code, "Ann");
    h.ws.close();
    await ann.c.until(() => ann.c.state().phase === "finished");
  });

  it("host:create while in a game leaves it first", async () => {
    const { h, code } = await host();
    const ann = await player(code, "Ann");
    await h.until(() => h.state().players.length === 1);
    const msgs = await h.call({ type: "host:create" }, 2);
    expect(msgs[0]).toMatchObject({ type: "welcome", role: "host" });
    expect((msgs[0] as { code: string }).code).not.toBe(code);
    await ann.c.until(() => ann.c.state().phase === "finished");
  });

  it("a player socket sending host:create leaves as a disconnected player", async () => {
    const { h, code } = await host();
    const { c } = await player(code, "Ann");
    await h.until(() => h.state().players.length === 1);
    await c.call({ type: "host:create" }, 2);
    await h.until(() => h.state().players.length === 0);
  });
});
