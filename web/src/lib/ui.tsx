import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { avatarHue, choiceLetter, initials, secondsLeft, timeFraction } from "./format";
import type { ConnectionStatus } from "./useGame";

/** The current time, refreshed every `everyMs` while mounted. */
export function useNow(everyMs = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`brand brand-${size}`} aria-label="Buzzline">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="15" fill="var(--accent)" />
          <path d="M18.5 5 9 18h6l-2 9 10-13h-6.2z" fill="var(--accent-ink)" />
        </svg>
      </span>
      <span className="brand-word">buzzline</span>
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const style = { "--hue": avatarHue(name) } as CSSProperties;
  return (
    <span className={`avatar avatar-${size}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function ChoiceLetter({ index }: { index: number }) {
  return (
    <span className="choice-letter" aria-hidden="true">
      {choiceLetter(index)}
    </span>
  );
}

/** A 🔥 streak count. Hidden below `min`, since one correct answer is not much of a streak. */
export function StreakBadge({ streak, min = 2, className = "" }: { streak: number; min?: number; className?: string }) {
  if (streak < Math.max(1, min)) return null;
  return (
    <span className={`streak ${className}`} title={`${streak} correct in a row`}>
      <span aria-hidden="true">🔥</span> {streak}
    </span>
  );
}

/** Round progress: one segment per question, filled up to the current one. */
export function Progress({ index, count }: { index: number; count: number }) {
  return (
    <div className="progress" role="img" aria-label={`Question ${index + 1} of ${count}`}>
      <span className="progress-label">
        Question <b>{index + 1}</b>
        <span className="muted"> / {count}</span>
      </span>
      <span className="progress-track" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`progress-seg ${i < index ? "is-done" : i === index ? "is-now" : ""}`} />
        ))}
      </span>
    </div>
  );
}

/** Circular countdown. Turns urgent in the last five seconds. */
export function TimerRing({ deadline, size = "md" }: { deadline: number | null; size?: "md" | "lg" }) {
  const now = useNow(200);
  const secs = secondsLeft(deadline, now);
  const frac = timeFraction(deadline, now);
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={`timer-ring timer-${size} ${secs <= 5 ? "is-urgent" : ""}`}
      role="timer"
      aria-label={`${secs} seconds left`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="timer-track" cx="50" cy="50" r={r} />
        <circle className="timer-fill" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span className="timer-num">{secs}</span>
    </div>
  );
}

/** Thin countdown bar plus a seconds pill, for the phone. */
export function TimerBar({ deadline }: { deadline: number | null }) {
  const now = useNow(200);
  const secs = secondsLeft(deadline, now);
  const frac = timeFraction(deadline, now);
  return (
    <div className={`timer-bar ${secs <= 5 ? "is-urgent" : ""}`} role="timer" aria-label={`${secs} seconds left`}>
      <span className="timer-bar-track" aria-hidden="true">
        <span className="timer-bar-fill" style={{ transform: `scaleX(${frac})` }} />
      </span>
      <span className="timer-pill">{secs}s</span>
    </div>
  );
}

export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status !== "closed") return null;
  return (
    <div className="banner" role="alert">
      <span className="banner-dot" aria-hidden="true" />
      <span>Connection lost.</span>
      <button className="btn btn-ghost btn-sm" onClick={() => location.reload()}>
        Reconnect
      </button>
    </div>
  );
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="toast" role="alert">
      <span aria-hidden="true">⚠️</span>
      <span>{message}</span>
      <button className="toast-close" aria-label="Dismiss" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

export function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

/** Wraps a phase's content so it animates in whenever `id` changes. */
export function Stage({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <main key={id} className={`stage ${className}`}>
      {children}
    </main>
  );
}
