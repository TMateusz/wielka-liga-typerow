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
