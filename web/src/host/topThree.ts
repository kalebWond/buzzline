import type { PlayerView } from "@buzzline/shared";

/** Top three players by score, high to low. Ties keep input order. Does not mutate input. */
export function topThree(players: PlayerView[]): PlayerView[] {
  return players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.score - a.p.score || a.i - b.i)
    .slice(0, 3)
    .map(({ p }) => p);
}
