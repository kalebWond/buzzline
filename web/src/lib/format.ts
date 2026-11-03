import { QUESTION_SECONDS } from "@buzzline/shared";
import type { CSSProperties } from "react";

/** Letters shown on the four answer tiles, so color is never the only cue. */
export const CHOICE_LETTERS = ["A", "B", "C", "D"] as const;

/** Letter for a choice index. Falls back to a 1-based number past D. */
export function choiceLetter(i: number): string {
  return CHOICE_LETTERS[i] ?? String(i + 1);
}

/** A stable hue (0 to 359) for a player's avatar, derived from their name. */
export function avatarHue(name: string): number {
  let h = 2166136261;
  for (const ch of name.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

/** One or two uppercase initials for an avatar. Emoji and accents stay whole. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (w: string | undefined) => (w ? Array.from(w)[0]!.toUpperCase() : "");
  if (words.length === 0) return "?";
  return words.length === 1 ? first(words[0]) : first(words[0]) + first(words[words.length - 1]);
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Whole seconds left before the deadline, between 0 and the question length. */
export function secondsLeft(deadline: number | null, now: number, total = QUESTION_SECONDS): number {
  if (deadline === null) return 0;
  return Math.min(total, Math.max(0, Math.ceil((deadline - now) / 1000)));
}

/** Share of the question time still left, from 1 (just started) to 0 (time is up). */
export function timeFraction(deadline: number | null, now: number, total = QUESTION_SECONDS): number {
  if (deadline === null || total <= 0) return 0;
  return Math.min(1, Math.max(0, (deadline - now) / (total * 1000)));
}

/** The link players open to join, with the code filled in. */
export function joinUrl(origin: string, code: string): string {
  return `${origin}/?code=${encodeURIComponent(code)}`;
}

/** Score with thousands separators, e.g. 12,345. */
export function formatScore(n: number): string {
  return n.toLocaleString("en-US");
}

/** Inline style that gives an element choice `i`'s color as `--choice`. */
export function choiceStyle(i: number): CSSProperties {
  return { "--choice": `var(--c${i % 4})` } as CSSProperties;
}
