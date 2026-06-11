export type KnockoutSide = "HOME" | "AWAY";

export function isKnockoutStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return !stage.startsWith("Grupa ");
}

export function isDrawScore(home: number, away: number): boolean {
  return home === away;
}

export function parseKnockoutSide(value: unknown): KnockoutSide | null {
  if (value === "HOME" || value === "AWAY") return value;
  return null;
}

/** Kto awansuje — przy remisie po 90′ z pola wyniku, inaczej ze wyniku regulaminowego. */
export function resolveActualKnockoutWinner(
  homeScore: number,
  awayScore: number,
  explicitWinner?: KnockoutSide | null,
): KnockoutSide | null {
  if (!isDrawScore(homeScore, awayScore)) {
    return homeScore > awayScore ? "HOME" : awayScore > homeScore ? "AWAY" : null;
  }
  return parseKnockoutSide(explicitWinner);
}
