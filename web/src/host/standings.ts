import type { PlayerView } from "@buzzline/shared";

/** Each player's score and rank at one moment, keyed by player id. */
export type Snapshot = Record<string, { score: number; rank: number }>;

export interface Standing {
  player: PlayerView;
  /** 1-based. Ties share the better rank. */
  rank: number;
  /** Points earned since the snapshot. 0 for players missing from it. */
  gained: number;
  /** Places climbed since the snapshot. Negative means they dropped. 0 for players missing from it. */
  moved: number;
}

function rankIn(players: PlayerView[], score: number): number {
  return players.filter((p) => p.score > score).length + 1;
}

/** Records every player's score and rank so a later reveal can show what changed. */
export function snapshot(players: PlayerView[]): Snapshot {
  const out: Snapshot = {};
  for (const p of players) out[p.id] = { score: p.score, rank: rankIn(players, p.score) };
  return out;
}

/**
 * Players high to low with rank, points gained and places moved since `before`. Does not mutate input.
 * Moves are all 0 when everyone was tied in `before` (e.g. the first question), since nobody truly dropped.
 */
export function standings(players: PlayerView[], before: Snapshot | null): Standing[] {
  const prevRanks = before ? Object.values(before).map((x) => x.rank) : [];
  const allTied = prevRanks.every((r) => r === prevRanks[0]);
  return players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.score - a.p.score || a.i - b.i)
    .map(({ p }) => {
      const rank = rankIn(players, p.score);
      const prev = before?.[p.id];
      return {
        player: p,
        rank,
        gained: prev ? p.score - prev.score : 0,
        moved: prev && !allTied ? prev.rank - rank : 0,
      };
    });
}
