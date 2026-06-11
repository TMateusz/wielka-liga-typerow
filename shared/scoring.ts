import {
  isKnockoutStage,
  parseKnockoutSide,
  resolveActualKnockoutWinner,
  type KnockoutSide,
} from "./knockout.js";

export type ScoreInput = {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stage?: string | null;
  predictedKnockoutWinner?: KnockoutSide | null;
  /** Zwycięzca po dogrywce / karnych — tylko przy remisie po 90′ (pole w bazie). */
  actualKnockoutWinner?: KnockoutSide | null;
};

export const SCORING = {
  EXACT: 3,
  OUTCOME: 1,
  /** Faza pucharowa: trafiony awans (niezależnie od wyniku po 90′). */
  KNOCKOUT_ADVANCE: 1,
  KNOCKOUT_MAX: 4,
  WRONG: 0,
} as const;

export function formatPoints(points: number): string {
  if (Number.isInteger(points)) return String(points);
  return points.toFixed(1);
}

export function getPointsToneClass(pts: number): string {
  if (pts >= SCORING.KNOCKOUT_MAX) return "text-sky-400";
  if (pts >= SCORING.EXACT) return "text-green-400";
  if (pts >= SCORING.OUTCOME + SCORING.KNOCKOUT_ADVANCE) return "text-yellow-400";
  if (pts >= SCORING.OUTCOME || pts >= SCORING.KNOCKOUT_ADVANCE) return "text-orange-400";
  return "text-red-400";
}

export type MatchOutcome = "home" | "away" | "draw";

export function getOutcome(home: number, away: number): MatchOutcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/** Punkty za wynik po 90′ (faza grupowa i regulaminowy czas w pucharze). */
export function calculateRegulationPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return SCORING.EXACT;
  }
  if (getOutcome(predictedHome, predictedAway) === getOutcome(actualHome, actualAway)) {
    return SCORING.OUTCOME;
  }
  return SCORING.WRONG;
}

export function isExactScorePrediction(
  predictedHome: number,
  predictedAway: number,
  actualHome: number | null,
  actualAway: number | null,
): boolean {
  return actualHome != null && actualAway != null && predictedHome === actualHome && predictedAway === actualAway;
}

export function calculatePoints(input: ScoreInput): number {
  const regulation = calculateRegulationPoints(
    input.predictedHome,
    input.predictedAway,
    input.actualHome,
    input.actualAway,
  );

  if (!isKnockoutStage(input.stage)) {
    return regulation;
  }

  const actualAdvancer = resolveActualKnockoutWinner(
    input.actualHome,
    input.actualAway,
    input.actualKnockoutWinner,
  );
  const predictedAdvancer = parseKnockoutSide(input.predictedKnockoutWinner);

  const advanceBonus =
    actualAdvancer && predictedAdvancer && actualAdvancer === predictedAdvancer
      ? SCORING.KNOCKOUT_ADVANCE
      : 0;

  return regulation + advanceBonus;
}

/** Okno typowania — 72 h (3 dni) przed rozpoczęciem meczu. */
export const BET_WINDOW_DAYS = 3;
export const BET_WINDOW_MS = BET_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function isMatchLocked(kickoffTime: Date, now: Date = new Date()): boolean {
  return now >= kickoffTime;
}

export function isBettingWindowTooEarly(kickoffTime: Date, now: Date = new Date()): boolean {
  return kickoffTime.getTime() - now.getTime() > BET_WINDOW_MS;
}

export function getBettingOpensAt(kickoffTime: Date): Date {
  return new Date(kickoffTime.getTime() - BET_WINDOW_MS);
}

export function formatBettingOpensAt(kickoffTime: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(getBettingOpensAt(kickoffTime));
}

export type BetBlockReason = "started" | "too_early" | "not_pending";

export function getBetBlockReason(
  status: string,
  kickoffTime: Date,
  now: Date = new Date(),
): BetBlockReason | null {
  if (status !== "PENDING") return "not_pending";
  if (isMatchLocked(kickoffTime, now)) return "started";
  if (isBettingWindowTooEarly(kickoffTime, now)) return "too_early";
  return null;
}

export function canBetOnMatch(
  status: string,
  kickoffTime: Date,
  now: Date = new Date(),
): boolean {
  return getBetBlockReason(status, kickoffTime, now) === null;
}

const NEXT_ROUND_MS = BET_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Mecz w „kolejce kolejnej” — typowanie otwarte, start w ciągu okna typowania. */
export function isInNextBettingRound(
  status: string,
  kickoffTime: Date,
  now: Date = new Date(),
): boolean {
  if (!canBetOnMatch(status, kickoffTime, now)) return false;
  return kickoffTime.getTime() - now.getTime() <= NEXT_ROUND_MS;
}

export function getDashboardMatchSortRank(
  match: { status: string; kickoffTime: Date | string },
  now: Date = new Date(),
): number {
  if (match.status === "FINISHED") return 2;
  if (canBetOnMatch(match.status, new Date(match.kickoffTime), now)) return 0;
  return 1;
}

export function sortDashboardMatches<T extends { status: string; kickoffTime: Date | string }>(
  matches: T[],
  options: { finishedTab?: boolean; now?: Date } = {},
): T[] {
  const { finishedTab = false, now = new Date() } = options;

  if (finishedTab) {
    return [...matches].sort(
      (a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime(),
    );
  }

  return [...matches].sort((a, b) => {
    const rankA = getDashboardMatchSortRank(a, now);
    const rankB = getDashboardMatchSortRank(b, now);
    if (rankA !== rankB) return rankA - rankB;
    return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  });
}
