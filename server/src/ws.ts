import type http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@buzzline/shared";
import { deck as defaultDeck, type DeckQuestion } from "./deck.js";
import { ERROR_ORDER, Game, systemClock, type Clock, type GameError } from "./game.js";

interface Room {
  game: Game;
  host: WebSocket | null;
  players: Map<string, WebSocket>;
}

interface Conn {
  room: Room;
  role: "host" | "player";
  playerId: string | null;
}

export interface WsOptions {
  clock?: Clock;
  deck?: DeckQuestion[];
}

function parse(raw: string): ClientMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof m !== "object" || m === null) return null;
  const o = m as Record<string, unknown>;
  switch (o.type) {
    case "host:create":
    case "host:start":
    case "host:next":
      return { type: o.type };
    case "player:join":
      return typeof o.code === "string" && typeof o.name === "string"
        ? { type: "player:join", code: o.code, name: o.name }
        : null;
    case "player:rejoin":
      return typeof o.code === "string" && typeof o.playerId === "string"
        ? { type: "player:rejoin", code: o.code, playerId: o.playerId }
        : null;
    case "player:answer":
      return typeof o.choice === "number" && Number.isInteger(o.choice) && o.choice >= 0 && o.choice <= 3
        ? { type: "player:answer", choice: o.choice }
        : null;
    default:
      return null;
  }
}

export function attachWebSocket(server: http.Server, opts: WsOptions = {}): WebSocketServer {
  const clock = opts.clock ?? systemClock;
  const deck = opts.deck ?? defaultDeck;
  const wss = new WebSocketServer({ server, path: "/ws" });
  const rooms = new Map<string, Room>();
  const conns = new Map<WebSocket, Conn>();

  const send = (ws: WebSocket, msg: ServerMessage): void => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  const fail = (ws: WebSocket, message: GameError): void => send(ws, { type: "error", message });

  const newCode = (): string => {
    for (;;) {
      let c = "";
      for (let i = 0; i < 4; i++) c += String.fromCharCode(65 + Math.floor(Math.random() * 26));
      if (!rooms.has(c)) return c;
    }
  };

  const broadcast = (room: Room): void => {
    const msg: ServerMessage = { type: "state", state: room.game.state() };
    if (room.host) send(room.host, msg);
    for (const p of room.players.values()) send(p, msg);
  };

  const prune = (room: Room): void => {
    if (room.game.state().phase === "finished" && !room.host && room.players.size === 0) {
      rooms.delete(room.game.code);
    }
  };

  const leave = (ws: WebSocket): void => {
    const conn = conns.get(ws);
    if (!conn) return;
    conns.delete(ws);
    const { room } = conn;
    if (conn.role === "host") {
      room.host = null;
      room.game.hostLeft();
    } else if (conn.playerId && room.players.get(conn.playerId) === ws) {
      room.players.delete(conn.playerId);
      room.game.removePlayer(conn.playerId);
    }
    prune(room);
  };

  const createRoom = (): Room => {
    const code = newCode();
    const room = { host: null, players: new Map() } as unknown as Room;
    room.game = new Game(code, deck, clock, () => broadcast(room));
    rooms.set(code, room);
    return room;
  };

  const handle = (ws: WebSocket, raw: string): void => {
    const msg = parse(raw);
    if (!msg) return fail(ws, "Invalid message");
    const conn = conns.get(ws);

    switch (msg.type) {
      case "host:create": {
        leave(ws);
        const room = createRoom();
        room.host = ws;
        conns.set(ws, { room, role: "host", playerId: null });
        send(ws, { type: "welcome", role: "host", playerId: null, code: room.game.code });
        broadcast(room);
        return;
      }
      case "player:join":
      case "player:rejoin": {
        const room = rooms.get(msg.code.toUpperCase());
        if (!room) return fail(ws, "Game not found");
        let err =
          msg.type === "player:join" ? room.game.checkJoin(msg.name) : room.game.checkRejoin(msg.playerId);
        // A socket already in a game may not join another. Ranks as "Not allowed now".
        if (conn && (!err || ERROR_ORDER.indexOf(err) > ERROR_ORDER.indexOf("Not allowed now"))) {
          err = "Not allowed now";
        }
        if (err) return fail(ws, err);

        let playerId: string;
        if (msg.type === "player:join") {
          const res = room.game.join(msg.name);
          if (!res.ok) return fail(ws, res.error);
          playerId = res.playerId;
        } else {
          playerId = msg.playerId;
          const old = room.players.get(playerId);
          if (old) {
            conns.delete(old); // so its close event is not treated as a disconnect
            room.players.delete(playerId);
            old.close();
          }
        }
        room.players.set(playerId, ws);
        conns.set(ws, { room, role: "player", playerId });
        send(ws, { type: "welcome", role: "player", playerId, code: room.game.code });
        broadcast(room);
        return;
      }
      case "host:start":
      case "host:next": {
        if (!conn || conn.role !== "host") return fail(ws, "Not allowed now");
        const res = msg.type === "host:start" ? conn.room.game.start() : conn.room.game.next();
        if (!res.ok) fail(ws, res.error);
        return;
      }
      case "player:answer": {
        if (!conn || conn.role !== "player" || !conn.playerId) return fail(ws, "Not allowed now");
        const res = conn.room.game.answer(conn.playerId, msg.choice);
        if (!res.ok) fail(ws, res.error);
        return;
      }
    }
  };

  wss.on("connection", (ws) => {
    ws.on("message", (data) => handle(ws, data.toString()));
    ws.on("close", () => leave(ws));
    ws.on("error", () => leave(ws));
  });

  return wss;
}
