import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createServer } from "./app.js";
import { FakeClock } from "./fakeClock.js";
import { attachWebSocket } from "./ws.js";

let server: http.Server | undefined;
let clients: WebSocket[] = [];

async function start(heartbeatMs?: number): Promise<{ clock: FakeClock; connect: () => Promise<{ pings: () => number }> }> {
  const clock = new FakeClock();
  const s = createServer();
  server = s;
  attachWebSocket(s, { clock, heartbeatMs });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as AddressInfo).port;
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    clients.push(ws);
    let n = 0;
    ws.on("ping", () => n++);
    await new Promise<void>((r) => ws.once("open", () => r()));
    return { pings: () => n };
  };
  return { clock, connect };
}

/** Lets in-flight ping frames reach the client. */
const flush = () => new Promise<void>((r) => setTimeout(r, 30));

afterEach(async () => {
  for (const c of clients) c.terminate();
  clients = [];
  const s = server;
  server = undefined;
  if (s) await new Promise<void>((r) => s.close(() => r()));
});

describe("heartbeat", () => {
  it("pings every client once per interval", async () => {
    const { clock, connect } = await start(1000);
    const a = await connect();
    const b = await connect();
    clock.advance(999);
    await flush();
    expect([a.pings(), b.pings()]).toEqual([0, 0]);
    clock.advance(1);
    await flush();
    expect([a.pings(), b.pings()]).toEqual([1, 1]);
    clock.advance(2000);
    await flush();
    expect([a.pings(), b.pings()]).toEqual([3, 3]);
  });

  it("defaults to every 30 seconds", async () => {
    const { clock, connect } = await start();
    const a = await connect();
    clock.advance(29_999);
    await flush();
    expect(a.pings()).toBe(0);
    clock.advance(1);
    await flush();
    expect(a.pings()).toBe(1);
  });

  it("is off when heartbeatMs is 0", async () => {
    const { clock, connect } = await start(0);
    const a = await connect();
    expect(clock.pending).toBe(0);
    clock.advance(120_000);
    await flush();
    expect(a.pings()).toBe(0);
  });

  it("stops when the server closes", async () => {
    const { clock } = await start(1000);
    expect(clock.pending).toBe(1);
    const s = server!;
    server = undefined;
    await new Promise<void>((r) => s.close(() => r()));
    expect(clock.pending).toBe(0);
  });
});
