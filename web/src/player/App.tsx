import { STREAK_BONUS, STREAK_LENGTH, type GameState, type PlayerView } from "@buzzline/shared";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { choiceStyle, formatScore, ordinal } from "../lib/format";
import { Avatar, Brand, ChoiceLetter, ConnectionBanner, Dots, Stage, StreakBadge, TimerBar } from "../lib/ui";
import { useGame } from "../lib/useGame";
import { findMe, rankOf, screenFor } from "./screenFor";

const STORE = "buzzline.player";

function readSaved(): { code: string; playerId: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
}

function forgetSaved() {
  try {
    sessionStorage.removeItem(STORE);
  } catch {
    /* storage unavailable */
  }
}

/** Leave this game for good and go back to an empty join form. */
function leave() {
  forgetSaved();
  location.href = "/";
}

function TopBar({ me }: { me: PlayerView }) {
  return (
    <header className="p-top">
      <span className="p-me">
        <Avatar name={me.name} size="sm" />
        <span className="p-me-name">{me.name}</span>
      </span>
      <span className="p-score">
        <StreakBadge streak={me.streak} />
        <b>{formatScore(me.score)}</b>
      </span>
    </header>
  );
}

function QuestionMeta({ s }: { s: GameState }) {
  return (
    <div className="p-meta">
      <span className="eyebrow">
        Question {s.questionIndex + 1} of {s.questionCount}
      </span>
      <TimerBar deadline={s.deadline} />
    </div>
  );
}

export default function PlayerApp() {
  const { ready, status, state, welcome, error, kicked, send } = useGame();
  const playerId = welcome?.role === "player" ? welcome.playerId : null;
  const screen = screenFor(state, playerId);
  const me = findMe(state, playerId);

  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [rejoining, setRejoining] = useState(() => readSaved() !== null);
  const [note, setNote] = useState<string | null>(null);
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
    if (kicked) forgetSaved();
  }, [kicked]);

  // Take back our place after a page reload.
  useEffect(() => {
    if (!ready || welcome || kicked) return;
    const saved = readSaved();
    if (saved) send({ type: "player:rejoin", code: saved.code, playerId: saved.playerId });
    else setRejoining(false);
  }, [ready, welcome, kicked, send]);

  // A failed rejoin (game or player gone) falls back to the join form with a gentle note.
  useEffect(() => {
    if (!rejoining) return;
    if (error) {
      forgetSaved();
      setNote("Your last game has ended. Join a new one below.");
    }
    if (error || welcome || status === "closed") setRejoining(false);
  }, [rejoining, error, welcome, status]);

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
    setNote(null);
    send({ type: "player:join", code: code.trim(), name });
  }

  function answer(i: number) {
    if (choice !== null) return;
    setChoice(i);
    send({ type: "player:answer", choice: i });
  }

  const shell = (node: React.ReactNode, tone = "") => (
    <div className={`app player ${tone}`}>
      <ConnectionBanner status={kicked ? "open" : status} />
      {node}
    </div>
  );

  if (kicked) {
    return shell(
      <Stage id="kicked" className="p-center">
        <div className="big-icon" aria-hidden="true">
          👋
        </div>
        <h1 className="display-sm">You were removed</h1>
        <p className="lede">The host removed you from this game.</p>
        <button className="btn btn-primary btn-block" onClick={leave}>
          Join another game
        </button>
      </Stage>,
    );
  }

  if (screen === "join" || !state || !me) {
    if (rejoining) {
      return shell(
        <Stage id="rejoin" className="p-center">
          <Dots />
          <p className="lede">Getting you back in the game</p>
        </Stage>,
      );
    }
    const canJoin = ready && code.trim().length > 0 && name.trim().length > 0;
    return shell(
      <Stage id="join" className="p-join">
        <div className="p-join-hero">
          <Brand size="lg" />
          <p className="lede">Answer fast. Climb the board.</p>
        </div>
        <form className="join-form card" onSubmit={join}>
          <label className="field">
            <span className="field-label">Game code</span>
            <input
              className="input input-code"
              placeholder="ABCD"
              value={code}
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              autoFocus={!code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            />
          </label>
          <label className="field">
            <span className="field-label">Your name</span>
            <input
              className="input"
              placeholder="e.g. Ada"
              value={name}
              maxLength={20}
              autoComplete="nickname"
              autoFocus={!!code}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {note ? (
            <p role="status" className="form-note">
              {note}
            </p>
          ) : (
            error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )
          )}
          <button className="btn btn-primary btn-block btn-lg" disabled={!canJoin}>
            {ready ? "Join game" : status === "closed" ? "Offline" : "Connecting…"}
          </button>
        </form>
      </Stage>,
    );
  }

  if (screen === "waiting") {
    const others = state.players.filter((p) => p.id !== me.id);
    return shell(
      <Stage id="waiting" className="p-center p-waiting">
        <div className="pulse-ring">
          <Avatar name={me.name} size="xl" />
        </div>
        <h1 className="display-sm">You're in!</h1>
        <p className="lede">
          Look at the host's screen. The game starts soon <Dots />
        </p>
        <div className="code-pill">{state.code}</div>
        {others.length > 0 && (
          <div className="p-others">
            <span className="muted">
              {others.length} other {others.length === 1 ? "player" : "players"} here
            </span>
            <div className="p-others-list">
              {others.slice(0, 12).map((p) => (
                <span key={p.id} className="mini-chip">
                  <Avatar name={p.name} size="sm" /> {p.name}
                </span>
              ))}
              {others.length > 12 && <span className="mini-chip muted">+{others.length - 12}</span>}
            </div>
          </div>
        )}
      </Stage>,
    );
  }

  if (screen === "answer") {
    return shell(
      <Stage id={`a${state.questionIndex}`} className="p-answer">
        <TopBar me={me} />
        <QuestionMeta s={state} />
        <h2 className="p-question">{state.question?.text}</h2>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="p-tiles">
          {state.question?.choices.map((c, i) => (
            <button
              key={i}
              className={`tile tile-btn ${choice === i ? "is-picked" : choice !== null ? "is-dim" : ""}`}
              style={{ ...choiceStyle(i), animationDelay: `${i * 50}ms` }}
              disabled={choice !== null}
              onClick={() => answer(i)}
            >
              <ChoiceLetter index={i} />
              <span className="tile-text">{c}</span>
            </button>
          ))}
        </div>
      </Stage>,
    );
  }

  if (screen === "locked") {
    const picked = choice !== null ? state.question?.choices[choice] : null;
    const answered = state.players.filter((p) => p.answered).length;
    return shell(
      <Stage id={`l${state.questionIndex}`} className="p-locked">
        <TopBar me={me} />
        <QuestionMeta s={state} />
        <div className="p-center p-grow">
          <span className="eyebrow">Locked in</span>
          {picked != null && choice !== null ? (
            <div className="tile tile-locked" style={choiceStyle(choice)}>
              <ChoiceLetter index={choice} />
              <span className="tile-text">{picked}</span>
            </div>
          ) : (
            <div className="big-icon" aria-hidden="true">
              🔒
            </div>
          )}
          <p className="lede">
            Waiting for the others <Dots />
          </p>
          <div className="meter" aria-label={`${answered} of ${state.players.length} answered`}>
            <span style={{ width: `${(answered / Math.max(1, state.players.length)) * 100}%` }} />
          </div>
          <span className="muted">
            {answered} of {state.players.length} answered
          </span>
        </div>
      </Stage>,
    );
  }

  if (screen === "reveal") {
    const gained = me.score - scoreBefore.current;
    const correct = choice !== null ? choice === state.correctIndex : gained > 0;
    const bonus = correct && me.streak > 0 && me.streak % STREAK_LENGTH === 0;
    const rank = rankOf(state, me.id);
    const answerText = state.correctIndex !== null ? state.question?.choices[state.correctIndex] : null;
    const tone = correct ? "tone-good" : me.answered ? "tone-bad" : "tone-slow";
    return shell(
      <Stage id={`r${state.questionIndex}`} className="p-center p-reveal">
        <div className={`verdict-icon ${tone}`} aria-hidden="true">
          {correct ? "✓" : me.answered ? "✕" : "⏱"}
        </div>
        <h1 className="display">{correct ? "Correct!" : me.answered ? "Not quite" : "Too slow"}</h1>
        {correct ? (
          <div className="gain-pill">+{formatScore(gained)}</div>
        ) : (
          answerText != null &&
          state.correctIndex !== null && (
            <div className="answer-was">
              <span className="muted">The answer was</span>
              <div className="tile tile-locked" style={choiceStyle(state.correctIndex)}>
                <ChoiceLetter index={state.correctIndex} />
                <span className="tile-text">{answerText}</span>
              </div>
            </div>
          )
        )}
        {bonus && (
          <div className="bonus">
            <span aria-hidden="true">🔥</span> {me.streak} in a row! Includes +{STREAK_BONUS} streak bonus
          </div>
        )}
        {!bonus && correct && me.streak > 1 && <StreakBadge streak={me.streak} className="streak-lg" />}
        <div className="stat-row">
          <div className="stat">
            <span className="stat-label">Score</span>
            <span className="stat-value">{formatScore(me.score)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Rank</span>
            <span className="stat-value">
              {ordinal(rank)}
              <span className="muted stat-of"> / {state.players.length}</span>
            </span>
          </div>
        </div>
      </Stage>,
      tone,
    );
  }

  const rank = rankOf(state, me.id);
  const medal = ["🥇", "🥈", "🥉"][rank - 1];
  return shell(
    <Stage id="finished" className="p-center p-finished">
      <span className="eyebrow">Game over</span>
      {medal ? (
        <div className="big-icon medal" aria-hidden="true">
          {medal}
        </div>
      ) : (
        <Avatar name={me.name} size="xl" />
      )}
      <h1 className="display">
        {ordinal(rank)} <span className="muted display-of">of {state.players.length}</span>
      </h1>
      <p className="lede">{rank === 1 ? "You won. Take a bow!" : rank <= 3 ? "On the podium. Nice work!" : "Thanks for playing!"}</p>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Final score</span>
          <span className="stat-value">{formatScore(me.score)}</span>
        </div>
      </div>
      <button className="btn btn-ghost btn-block" onClick={leave}>
        Join another game
      </button>
    </Stage>,
    rank <= 3 ? "tone-gold" : "",
  );
}
