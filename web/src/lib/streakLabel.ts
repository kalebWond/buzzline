/** Text for a streak badge. Empty when there is no streak. */
export function streakLabel(streak: number): string {
  return streak > 0 ? `🔥 ${streak}` : "";
}
