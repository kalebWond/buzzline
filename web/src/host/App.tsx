import type { GameState, PlayerView } from "@buzzline/shared";
import { useEffect, useState } from "react";
import { useGame } from "../lib/useGame";
import { topThree } from "./topThree";

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "4vh 5vw",
  background: "#14102b",
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
  textAlign: "center",
  boxSizing: "border-box",
};
const big: React.CSSProperties = { fontSize: "4vw", margin: "2vh 0" };
const button: React.CSSProperties = {
  fontSize: "3vw",
  padding: "1.5vh 4vw",
  borderRadius: 16,
  border: "none",
  background: "#ffcc00",
  cursor: "pointer",
  marginTop: "4vh",
};
const colors = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];

function Podium({ players }: { players: PlayerView[] }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, fontSize: "3.5vw" }}>
      {topThree(players).map((p, i) => (
        <li key={p.id} style={{ margin: "1.5vh 0" }}>
          {["🥇", "🥈", "🥉"][i]} {p.name} — {p.score}
        </li>
      ))}
    </ol>
  );
}

function Lobby({ s, onStart }: { s: GameState; onStart: () => void }) {
  return (
    <>
      <div style={{ fontSize: "2.5vw" }}>Join with code</div>
      <div style={{ fontSize: "14vw", fontWeight: 800, letterSpacing: "0.2em" }}>{s.code}</div>
      <div style={{ ...big, display: "flex", flexWrap: "wrap", gap: "1vw", justifyContent: "center" }}>
        {s.players.map((p) => (
          <span key={p.id} style={{ background: "#3a2f7a", padding: "0.5vh 2vw", borderRadius: 12 }}>
            {p.name}
          </span>
        ))}
      </div>
      <div style={{ fontSize: "2.5vw" }}>{s.players.length} player(s)</div>
      <button style={{ ...button, opacity: s.players.length ? 1 : 0.4 }} disabled={!s.players.length} onClick={onStart}>
        Start
      </button>
    </>
  );
}

function Countdown({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const secs = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return <div style={{ fontSize: "6vw", fontWeight: 800 }}>{secs}</div>;
}

function Choices({ s }: { s: GameState }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2vw" }}>
      {s.question?.choices.map((c, i) => {
        const dim = s.correctIndex !== null && s.correctIndex !== i;
        return (
          <div
            key={i}
            style={{
              background: colors[i % 4],
              padding: "4vh 2vw",
              borderRadius: 16,
              fontSize: "3.5vw",
              opacity: dim ? 0.3 : 1,
              outline: s.correctIndex === i ? "0.6vw solid #fff" : "none",
            }}
          >
            {c}
          </div>
        );
      })}
    </div>
  );
}

function Question({ s }: { s: GameState }) {
  const answered = s.players.filter((p) => p.answered).length;
  return (
    <>
      <div style={{ fontSize: "2vw" }}>
        Question {s.questionIndex + 1} / {s.questionCount}
      </div>
      <Countdown deadline={s.deadline} />
      <h1 style={{ fontSize: "5vw", margin: "2vh 0" }}>{s.question?.text}</h1>
      <Choices s={s} />
      <div style={{ fontSize: "3vw", marginTop: "3vh" }}>
        {answered} / {s.players.length} answered
      </div>
    </>
  );
}

function Reveal({ s, onNext }: { s: GameState; onNext: () => void }) {
  const last = s.questionIndex + 1 >= s.questionCount;
  return (
    <>
      <h1 style={{ fontSize: "4vw", margin: "1vh 0" }}>{s.question?.text}</h1>
      <Choices s={s} />
      <h2 style={big}>Top players</h2>
      <Podium players={s.players} />
      <button style={button} onClick={onNext}>
        {last ? "Finish" : "Next"}
      </button>
    </>
  );
}

export default function HostApp() {
  const { ready, state, error, send } = useGame();

  useEffect(() => {
    if (ready) send({ type: "host:create" });
  }, [ready, send]);

  return (
    <div style={page}>
      {error && <div style={{ background: "#e21b3c", padding: 8, borderRadius: 8 }}>{error}</div>}
      {!state && <h1 style={big}>{ready ? "Creating game…" : "Connecting…"}</h1>}
      {state?.phase === "lobby" && <Lobby s={state} onStart={() => send({ type: "host:start" })} />}
      {state?.phase === "question" && <Question s={state} />}
      {state?.phase === "reveal" && <Reveal s={state} onNext={() => send({ type: "host:next" })} />}
      {state?.phase === "finished" && (
        <>
          <h1 style={{ fontSize: "7vw", margin: "2vh 0" }}>Final podium</h1>
          <Podium players={state.players} />
        </>
      )}
    </div>
  );
}
