import { DECKS, QUESTION_SECONDS, REVEAL_SECONDS, STREAK_BONUS, STREAK_LENGTH, type DeckId, type GameState, type PlayerView } from "@buzzline/shared";
import { useEffect, useRef, useState } from "react";
import { choiceStyle, formatScore, joinUrl, ordinal } from "../lib/format";
import {
  Avatar,
  Brand,
  ChoiceLetter,
  ConnectionBanner,
  Dots,
  Progress,
  RevealCountdown,
  Setting,
  Stage,
  StreakBadge,
  TimerRing,
  Toast,
} from "../lib/ui";
import { useGame } from "../lib/useGame";
import { barPercents } from "./barHeights";
import { snapshot, standings, type Snapshot } from "./standings";
import { topThree } from "./topThree";

const DECK_INFO: Record<DeckId, { emoji: string; blurb: string; hue: number }> = {
  classic: { emoji: "🎯", blurb: "A bit of everything: planets, paintings and polygons.", hue: 48 },
  science: { emoji: "🔬", blurb: "Atoms, cells, stars and the forces between them.", hue: 190 },
  geography: { emoji: "🌍", blurb: "Rivers, capitals, oceans and mountains.", hue: 140 },
};

const QUESTIONS_PER_GAME = 5;
const LEADERBOARD_SIZE = 5;

/* ---------- Deck picker ---------- */

function DeckPicker({ ready, onPick }: { ready: boolean; onPick: (id: DeckId) => void }) {
  return (
    <Stage id="picker" className="host-picker">
      <div className="hero">
        <span className="eyebrow">Host a game</span>
        <h1 className="display">Pick a deck to play</h1>
        <p className="lede">
          {QUESTIONS_PER_GAME} questions, {QUESTION_SECONDS} seconds each. Faster answers score more, and every{" "}
          {STREAK_LENGTH} in a row earns a +{STREAK_BONUS} bonus.
        </p>
      </div>
      <div className="deck-grid">
        {DECKS.map((d, i) => {
          const info = DECK_INFO[d.id];
          return (
            <button
              key={d.id}
              className="deck-card"
              style={{ "--deck-hue": info.hue, animationDelay: `${i * 70}ms` } as React.CSSProperties}
              disabled={!ready}
              onClick={() => onPick(d.id)}
            >
              <span className="deck-emoji" aria-hidden="true">
                {info.emoji}
              </span>
              <span className="deck-name">{d.name}</span>
              <span className="deck-blurb">{info.blurb}</span>
              <span className="deck-cta">
                {ready ? "Create game" : "Connecting…"} <span aria-hidden="true">→</span>
              </span>
            </button>
          );
        })}
      </div>
    </Stage>
  );
}

/* ---------- Lobby ---------- */

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => setCopied(true),
          () => {},
        );
      }}
    >
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}

function Lobby({
  s,
  deckId,
  onStart,
  onKick,
}: {
  s: GameState;
  deckId: DeckId | null;
  onStart: (autoAdvance: boolean) => void;
  onKick: (playerId: string) => void;
}) {
  const url = joinUrl(location.origin, s.code);
  const deck = DECKS.find((d) => d.id === deckId);
  const n = s.players.length;
  const [auto, setAuto] = useState(true); // on unless the host turns it off
  return (
    <Stage id="lobby" className="host-lobby">
      <section className="join-panel card">
        <span className="eyebrow">Join on your phone</span>
        <div className="join-host">{location.host}</div>
        <span className="eyebrow">Game code</span>
        <div className="code" aria-label={`Game code ${s.code.split("").join(" ")}`}>
          {s.code.split("").map((ch, i) => (
            <span key={i} className="code-cell" style={{ animationDelay: `${i * 60}ms` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="join-link">
          <code>{url.replace(/^https?:\/\//, "")}</code>
          <CopyLink url={url} />
        </div>
        {deck && (
          <div className="deck-tag">
            <span aria-hidden="true">{DECK_INFO[deck.id].emoji}</span> {deck.name} deck
          </div>
        )}
      </section>

      <section className="roster">
        <header className="roster-head">
          <h2>Players</h2>
          <span className="count-badge" aria-live="polite">
            {n}
          </span>
        </header>
        {n === 0 ? (
          <div className="roster-empty">
            <Dots />
            <p>Waiting for players to join</p>
          </div>
        ) : (
          <ul className="roster-grid">
            {s.players.map((p) => (
              <li key={p.id} className="player-chip">
                <Avatar name={p.name} size="sm" />
                <span className="player-chip-name">{p.name}</span>
                <button className="chip-kick" aria-label={`Kick ${p.name}`} title={`Kick ${p.name}`} onClick={() => onKick(p.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <Setting
          label="Move on automatically"
          description={`Show each answer for ${REVEAL_SECONDS} seconds, then start the next question by itself. You can still skip ahead.`}
          checked={auto}
          onChange={setAuto}
        />
        <footer className="roster-foot">
          <span className="muted">{n === 0 ? "Need at least 1 player to start" : `${n} ready to play`}</span>
          <button className="btn btn-primary btn-xl" disabled={n === 0} onClick={() => onStart(auto)}>
            Start game <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </Stage>
  );
}

/* ---------- Question ---------- */

function AnsweredMeter({ players }: { players: PlayerView[] }) {
  const answered = players.filter((p) => p.answered).length;
  return (
    <div className="answered-meter" aria-live="polite">
      <span className="answered-num">
        <b>{answered}</b>
        <span className="muted"> / {players.length}</span>
      </span>
      <span className="muted answered-label">answered</span>
      <span className="answered-dots" aria-hidden="true">
        {players.slice(0, 24).map((p) => (
          <span key={p.id} className={`answered-dot ${p.answered ? "is-on" : ""}`} title={p.name} />
        ))}
      </span>
    </div>
  );
}

function Question({ s }: { s: GameState }) {
  return (
    <Stage id={`q${s.questionIndex}`} className="host-question">
      <header className="host-bar">
        <Progress index={s.questionIndex} count={s.questionCount} />
        <AnsweredMeter players={s.players} />
      </header>
      <div className="question-row">
        <TimerRing deadline={s.deadline} size="lg" />
        <h1 className="question-text">{s.question?.text}</h1>
      </div>
      <div className="tiles">
        {s.question?.choices.map((c, i) => (
          <div key={i} className="tile" style={{ ...choiceStyle(i), animationDelay: `${120 + i * 70}ms` }}>
            <ChoiceLetter index={i} />
            <span className="tile-text">{c}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/* ---------- Reveal ---------- */

function Results({ s }: { s: GameState }) {
  const counts = s.answerCounts ?? s.question?.choices.map(() => 0) ?? [];
  const pct = barPercents(counts);
  const right = s.correctIndex !== null ? (counts[s.correctIndex] ?? 0) : 0;
  return (
    <section className="results card">
      <ul className="result-list">
        {s.question?.choices.map((c, i) => {
          const correct = i === s.correctIndex;
          return (
            <li key={i} className={`result-row ${correct ? "is-correct" : "is-wrong"}`} style={choiceStyle(i)}>
              <ChoiceLetter index={i} />
              <div className="result-body">
                <div className="result-text">
                  <span>{c}</span>
                  {correct && (
                    <span className="result-check" aria-label="Correct answer">
                      ✓
                    </span>
                  )}
                </div>
                <div className="result-bar" aria-hidden="true">
                  <span style={{ width: `${pct[i]}%`, animationDelay: `${200 + i * 80}ms` }} />
                </div>
              </div>
              <span className="result-count" aria-label={`${counts[i]} votes`}>
                {counts[i]}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="results-foot muted">
        <b className="text">{right}</b> of {s.players.length} got it right
      </p>
    </section>
  );
}

function Leaderboard({ s, before }: { s: GameState; before: Snapshot | null }) {
  const rows = standings(s.players, before).slice(0, LEADERBOARD_SIZE);
  return (
    <section className="leaderboard card">
      <h2 className="card-title">Leaderboard</h2>
      <ol className="lb-list">
        {rows.map(({ player: p, rank, gained, moved }, i) => (
          <li key={p.id} className={`lb-row ${rank === 1 ? "is-leader" : ""}`} style={{ animationDelay: `${300 + i * 80}ms` }}>
            <span className="lb-rank">{rank}</span>
            <Avatar name={p.name} size="sm" />
            <span className="lb-name">
              {p.name}
              <StreakBadge streak={p.streak} />
            </span>
            {moved !== 0 && (
              <span className={`lb-move ${moved > 0 ? "is-up" : "is-down"}`} aria-label={moved > 0 ? `Up ${moved}` : `Down ${-moved}`}>
                {moved > 0 ? "▲" : "▼"}
                {Math.abs(moved)}
              </span>
            )}
            {gained > 0 && <span className="lb-gain">+{formatScore(gained)}</span>}
            <span className="lb-score">{formatScore(p.score)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Reveal({ s, before, onNext }: { s: GameState; before: Snapshot | null; onNext: () => void }) {
  const last = s.questionIndex + 1 >= s.questionCount;
  return (
    <Stage id={`r${s.questionIndex}`} className="host-reveal">
      <header className="host-bar">
        <Progress index={s.questionIndex} count={s.questionCount} />
        <RevealCountdown nextAt={s.nextAt} />
        <button className="btn btn-primary btn-lg" onClick={onNext} autoFocus>
          {last ? "Final results" : "Next question"} <span aria-hidden="true">→</span>
        </button>
      </header>
      <h1 className="question-text question-text-sm">{s.question?.text}</h1>
      <div className="reveal-grid">
        <Results s={s} />
        <Leaderboard s={s} before={before} />
      </div>
    </Stage>
  );
}

/* ---------- Finished ---------- */

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => (
        <span
          key={i}
          style={
            {
              "--x": `${(i * 37) % 100}%`,
              "--d": `${(i % 7) * 0.35}s`,
              "--t": `${3.2 + (i % 5) * 0.5}s`,
              "--r": `${(i * 53) % 360}deg`,
              "--c": `var(--c${i % 4})`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Finished({ s, onNewGame }: { s: GameState; onNewGame: () => void }) {
  const top = topThree(s.players);
  // Visual order on the podium: 2nd, 1st, 3rd.
  const podium = [top[1], top[0], top[2]].map((p, slot) => ({ p, place: [2, 1, 3][slot]! })).filter((x) => x.p);
  const rest = standings(s.players, null).slice(3, 10);
  return (
    <Stage id="finished" className="host-finished">
      <Confetti />
      <header className="host-bar finished-bar">
        <span className="eyebrow">Game over</span>
        <button className="btn btn-ghost" onClick={onNewGame}>
          New game
        </button>
      </header>
      <h1 className="display finished-title">{top[0] ? `${top[0].name} wins!` : "Final results"}</h1>
      <div className="podium">
        {podium.map(({ p, place }) => (
          <div key={p!.id} className={`podium-col place-${place}`}>
            <div className="podium-who">
              {place === 1 && (
                <span className="crown" aria-hidden="true">
                  👑
                </span>
              )}
              <Avatar name={p!.name} size={place === 1 ? "xl" : "lg"} />
              <span className="podium-name">{p!.name}</span>
              <span className="podium-score">{formatScore(p!.score)}</span>
            </div>
            <div className="podium-block">
              <span className="podium-place">{ordinal(place)}</span>
            </div>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="rest-list">
          {rest.map(({ player: p, rank }) => (
            <li key={p.id}>
              <span className="lb-rank">{rank}</span>
              <Avatar name={p.name} size="sm" />
              <span className="lb-name">{p.name}</span>
              <span className="lb-score">{formatScore(p.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </Stage>
  );
}

/* ---------- App ---------- */

export default function HostApp() {
  const { ready, status, state, error, send, reset, dismissError } = useGame();
  const [deckId, setDeckId] = useState<DeckId | null>(null);
  const [picking, setPicking] = useState(true);

  // Scores and ranks when the current question started, so the reveal can show what changed.
  const before = useRef<Snapshot | null>(null);
  const phase = state?.phase;
  const qIndex = state?.questionIndex;
  useEffect(() => {
    if (phase === "question" && state) before.current = snapshot(state.players);
    // Only when a new question starts; later states in the same question carry the same scores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex]);

  function pick(id: DeckId) {
    reset();
    before.current = null;
    setDeckId(id);
    setPicking(false);
    send({ type: "host:create", deckId: id });
  }

  let body: React.ReactNode;
  if (picking) body = <DeckPicker ready={ready} onPick={pick} />;
  else if (!state)
    body = (
      <Stage id="creating" className="host-center">
        <Dots />
        <p className="lede">Setting up your game</p>
      </Stage>
    );
  else if (state.phase === "lobby")
    body = (
      <Lobby
        s={state}
        deckId={deckId}
        onStart={(autoAdvance) => send({ type: "host:start", autoAdvance })}
        onKick={(playerId) => send({ type: "host:kick", playerId })}
      />
    );
  else if (state.phase === "question") body = <Question s={state} />;
  else if (state.phase === "reveal") body = <Reveal s={state} before={before.current} onNext={() => send({ type: "host:next" })} />;
  else body = <Finished s={state} onNewGame={() => setPicking(true)} />;

  return (
    <div className="app host">
      <div className="topline">
        <Brand size="sm" />
        {state && !picking && state.phase !== "lobby" && <span className="code-pill">{state.code}</span>}
      </div>
      <ConnectionBanner status={status} />
      <Toast message={error} onClose={dismissError} />
      {body}
    </div>
  );
}
