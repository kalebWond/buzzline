import type { GameState, PlayerView } from "@buzzline/shared";

export type Screen = "join" | "waiting" | "answer" | "locked" | "reveal" | "finished";

export function findMe(state: GameState | null, playerId: string | null): PlayerView | null {
  if (!state || !playerId) return null;
  return state.players.find((p) => p.id === playerId) ?? null;
}

export function screenFor(state: GameState | null, playerId: string | null): Screen {
  const me = findMe(state, playerId);
  if (!state || !me) return "join";
  switch (state.phase) {
    case "lobby":
      return "waiting";
    case "question":
      return me.answered ? "locked" : "answer";
    case "reveal":
      return "reveal";
    case "finished":
      return "finished";
  }
}

/** 1-based rank; players are sorted high to low, ties share the better rank. */
export function rankOf(state: GameState, playerId: string): number {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return 0;
  return state.players.filter((p) => p.score > me.score).length + 1;
}
