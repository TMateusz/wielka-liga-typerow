/** Czy nazwa to placeholder (np. „2. miejsce Gr. A”, „Zwycięzca M74”). */
export function isPlaceholderTeam(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("gr.") ||
    n.includes("miejsce") ||
    n.includes("zwycięzca") ||
    n.includes("przegrany") ||
    n.includes("winner") ||
    n.includes("loser") ||
    n.includes("3. miejsce")
  );
}

export function isPlaceholderMatch(homeTeam: string, awayTeam: string): boolean {
  return isPlaceholderTeam(homeTeam) || isPlaceholderTeam(awayTeam);
}
