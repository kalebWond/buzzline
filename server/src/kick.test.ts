import type http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { ServerMessage } from "@buzzline/shared";
import { createServer } from "./app.js";
import { FakeClock } from "./fakeClock.js";
import { attachWebSocket } from "./ws.js";

let server: http.Server;
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
  async until(pred: () => boolean): Promise<void> {
    while (!pred()) {
      await new Promise<void>((res, rej) => {
        this.waiters.push(res);
        setTimeout(() => rej(new Error("timeout; got " + JSON.stringify(this.msgs))), 2000);
      });
    }
  }
  async call(m: unknown, n = 1): Promise<ServerMessage[]> {
    const start = this.msgs.length;
    this.ws.send(typeof m === "string" ? m : JSON.stringify(m));
    await this.until(() => this.msgs.length >= start + n);
    return this.msgs.slice(start, start + n);
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

async function host() {
  const h = await connect();
  const [w] = await h.call({ type: "host:create" }, 2);
  if (w!.type !== "welcome") throw new Error("no welcome");
  return { h, code: w!.code };
}

async function player(code: string, name: string) {
  const c = await connect();
  const [w] = await c.call({ type: "player:join", code, name }, 2);
  if (w!.type !== "welcome" || !w!.playerId) throw new Error("no welcome");
  return { c, id: w!.playerId };
}

const errOf = (m: ServerMessage | undefined) => (m?.type === "error" ? m.message : m?.type);

beforeEach(async () => {
  server = createServer();
  attachWebSocket(server, { clock: new FakeClock() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const c of open) c.ws.terminate();
  open = [];
  await new Promise<void>((r) => server.close(() => r()));
});

describe("host:kick", () => {
  it("sends kicked, closes the socket and updates everyone else exactly once", async () => {
    const { h, code } = await host();
    const a = await player(code, "Ann");
    const b = await player(code, "Bob");
    await h.until(() => h.state().players.length === 2);
    const hostBefore = h.msgs.length;
    const bobBefore = b.c.msgs.length;

    h.ws.send(JSON.stringify({ type: "host:kick", playerId: a.id }));
    await a.c.until(() => a.c.closed);
    await h.until(() => h.msgs.length === hostBefore + 1);
    await b.c.until(() => b.c.msgs.length === bobBefore + 1);

    expect(a.c.msgs.at(-1)).toEqual({ type: "kicked" });
    expect(a.c.msgs.filter((m) => m.type === "kicked")).toHaveLength(1);
    expect(h.state().players.map((p) => p.name)).toEqual(["Bob"]);
    expect(b.c.state().players.map((p) => p.name)).toEqual(["Bob"]);

    // The kicked socket's close must not produce a second broadcast.
    await new Promise((r) => setTimeout(r, 50));
    expect(h.msgs.length).toBe(hostBefore + 1);
  });

  it("lets the kicked name be reused and refuses a rejoin", async () => {
    const { h, code } = await host();
    const a = await player(code, "Ann");
    h.ws.send(JSON.stringify({ type: "host:kick", playerId: a.id }));
    await a.c.until(() => a.c.closed);
    const c = await connect();
    const [m] = await c.call({ type: "player:rejoin", code, playerId: a.id });
    expect(errOf(m)).toBe("Player not found");
    const again = await player(code, "Ann");
    expect(again.id).not.toBe(a.id);
  });

  it("errors: unknown player, non-host sender, bad fields, outside lobby", async () => {
    const { h, code } = await host();
    const a = await player(code, "Ann");
    const b = await player(code, "Bob");
    await h.until(() => h.state().players.length === 2);
    await a.c.until(() => a.c.state().players.length === 2);

    expect(errOf((await h.call({ type: "host:kick", playerId: "nope" }))[0])).toBe("Player not found");
    expect(errOf((await h.call({ type: "host:kick" }))[0])).toBe("Invalid message");
    expect(errOf((await h.call({ type: "host:kick", playerId: 5 }))[0])).toBe("Invalid message");
    // A player kicking someone real: not allowed. Unknown id outranks it.
    expect(errOf((await a.c.call({ type: "host:kick", playerId: b.id }))[0])).toBe("Not allowed now");
    expect(errOf((await a.c.call({ type: "host:kick", playerId: "nope" }))[0])).toBe("Player not found");
    // A socket in no game.
    const lone = await connect();
    expect(errOf((await lone.call({ type: "host:kick", playerId: b.id }))[0])).toBe("Not allowed now");

    h.ws.send(JSON.stringify({ type: "host:start" }));
    await h.until(() => h.state().phase === "question");
    expect(errOf((await h.call({ type: "host:kick", playerId: b.id }))[0])).toBe("Not allowed now");
    expect(h.state().players).toHaveLength(2);
    expect(b.c.closed).toBe(false);
  });
});
