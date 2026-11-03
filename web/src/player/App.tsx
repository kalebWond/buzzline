import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useGame } from "../lib/useGame";
import { findMe, rankOf, screenFor } from "./screenFor";

const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
const STORE = "buzzline.player";

const page: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 16,
  padding: 20,
  boxSizing: "border-box",
  fontFamily: "system-ui, sans-serif",
  textAlign: "center",
  background: "#2d1b69",
  color: "#fff",
};
const input: CSSProperties = { fontSize: 22, padding: 14, borderRadius: 8, border: 0, textAlign: "center" };
const bigButton: CSSProperties = { fontSize: 22, padding: 16, borderRadius: 8, border: 0, background: "#26890c", color: "#fff" };
const errStyle: CSSProperties = { color: "#ffb3b3", margin: 0 };

function readSaved(): { code: string; playerId: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
}

export default function PlayerApp() {
  const { ready, state, welcome, error, kicked, send } = useGame();
  const playerId = welcome?.role === "player" ? welcome.playerId : null;
  const screen = screenFor(state, playerId);
  const me = findMe(state, playerId);

  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const scoreBefore = useRef(0);
  const inQuestion = state?.phase === "question";
  const questionIndex = state?.questionIndex;
  const myScore = me?.score ?? 0;

  useEffect(() => {
    if (welcome?.role === "player" && welcome.playerId) {
      try {
        sessionStorage.setItem(STORE, JSON.stringify({ code: welcome.code, playerId: welcome.playerId }));
      } catch {
        /* storage unavailable */
      }
    }
  }, [welcome]);

  // A kicked player must not try to come back after a reload.
  useEffect(() => {
    if (!kicked) return;
    try {
      sessionStorage.removeItem(STORE);
    } catch {
      /* storage unavailable */
    }
  }, [kicked]);

  // Take back our place after a page reload.
  useEffect(() => {
    if (!ready || welcome || kicked) return;
    const saved = readSaved();
    if (saved) send({ type: "player:rejoin", code: saved.code, playerId: saved.playerId });
  }, [ready, welcome, kicked, send]);

  // New question: forget the last choice and remember the score to show points gained.
  useEffect(() => {
    if (inQuestion) {
      setChoice(null);
      scoreBefore.current = myScore;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, inQuestion]);

  function join(e: FormEvent) {
    e.preventDefault();
    send({ type: "player:join", code: code.trim(), name });
  }

  function answer(i: number) {
    setChoice(i);
    send({ type: "player:answer", choice: i });
  }

  if (kicked) {
    return (
      <div style={page}>
        <h1>Removed from the game</h1>
        <p>The host removed you from the game.</p>
      </div>
    );
  }

  if (screen === "join" || !state || !me) {
    return (
      <form style={page} onSubmit={join}>
        <h1>Buzzline</h1>
        <input style={input} placeholder="Game code" value={code} maxLength={4} autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <input style={input} placeholder="Your name" value={name} maxLength={20}
          onChange={(e) => setName(e.target.value)} />
        {error && <p role="alert" style={errStyle}>{error}</p>}
        <button style={bigButton} disabled={!ready || !code.trim() || !name.trim()}>
          {ready ? "Join" : "Connecting…"}
        </button>
      </form>
    );
  }

  if (screen === "waiting") {
    return (
      <div style={page}>
        <h1>You're in, {me.name}!</h1>
        <p>Waiting for the host to start… ({state.players.length} players)</p>
      </div>
    );
  }

  if (screen === "answer") {
    return (
      <div style={{ ...page, justifyContent: "flex-start" }}>
        <p style={{ margin: 0 }}>Question {state.questionIndex + 1} of {state.questionCount}</p>
        <h2 style={{ margin: 0 }}>{state.question?.text}</h2>
        {error && <p role="alert" style={errStyle}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 }}>
          {state.question?.choices.map((c, i) => (
            <button key={i} onClick={() => answer(i)}
              style={{ background: COLORS[i % 4], color: "#fff", border: 0, borderRadius: 8, fontSize: 20, padding: 12, minHeight: 100 }}>
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "locked") {
    const picked = choice !== null ? state.question?.choices[choice] : null;
    return (
      <div style={page}>
        <h1>Locked in!</h1>
        {picked && choice !== null && (
          <p style={{ background: COLORS[choice % 4], padding: 16, borderRadius: 8 }}>{picked}</p>
        )}
        <p>Waiting for the others…</p>
      </div>
    );
  }

  if (screen === "reveal") {
    const gained = me.score - scoreBefore.current;
    const correct = choice !== null ? choice === state.correctIndex : gained > 0;
    return (
      <div style={{ ...page, background: correct ? "#26890c" : "#c0392b" }}>
        <h1>{correct ? "Correct!" : me.answered ? "Wrong" : "Too slow"}</h1>
        {gained > 0 && <p>+{gained} points</p>}
        <p style={{ fontSize: 28 }}>Score: {me.score}</p>
        <p>Rank {rankOf(state, me.id)} of {state.players.length}</p>
      </div>
    );
  }

  return (
    <div style={page}>
      <h1>Game over</h1>
      <p style={{ fontSize: 28 }}>Final score: {me.score}</p>
      <p style={{ fontSize: 22 }}>Rank {rankOf(state, me.id)} of {state.players.length}</p>
    </div>
  );
}
