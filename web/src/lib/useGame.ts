import type { ClientMessage, GameState, ServerMessage } from "@buzzline/shared";
import { useCallback, useEffect, useRef, useState } from "react";

export type Welcome = Extract<ServerMessage, { type: "welcome" }>;

/** "connecting" until the socket opens; "closed" once it has dropped. */
export type ConnectionStatus = "connecting" | "open" | "closed";

export function useGame() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [state, setState] = useState<GameState | null>(null);
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
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
      else if (msg.type === "kicked") setKicked(true);
    };
    return () => {
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  /** Forget the current game locally, e.g. before the host creates a new one. */
  const reset = useCallback(() => {
    setState(null);
    setWelcome(null);
    setError(null);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return { ready: status === "open", status, state, welcome, error, kicked, send, reset, dismissError };
}
