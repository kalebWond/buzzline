import type { ClientMessage, GameState, ServerMessage } from "@buzzline/shared";
import { useCallback, useEffect, useRef, useState } from "react";

export type Welcome = Extract<ServerMessage, { type: "welcome" }>;

export function useGame() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => setReady(true);
    ws.onclose = () => setReady(false);
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "welcome") setWelcome(msg);
      else if (msg.type === "state") {
        setState(msg.state);
        setError(null);
      } else if (msg.type === "error") setError(msg.message);
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return { ready, state, welcome, error, send };
}
