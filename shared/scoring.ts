import { isKnockoutStage, type KnockoutSide } from "./knockout.js";

export type ScoreInput = {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stage?: string | null;
  predictedKnockoutWinner?: KnockoutSide | null;
  actualKnockoutWinner?: KnockoutSide | null;
};

export const SCORING = {
  EXACT: 3,
  OUTCOME: 1,
  KNOCKOUT_DRAW_WINNER: 2,
  /** Puchar: trafiony zwycięzca, ale typ na wygraną w 90′ zamiast remisu */
  KNOCKOUT_WINNER_AFTER_REG_DRAW: 0.5,
  WRONG: 0,
} as const;

export function formatPoints(points: number): string {
  if (Number.isInteger(points)) return String(points);
  return points.toFixed(1);
}

export type MatchOutcome = "home" | "away" | "draw";

export function getOutcome(home: number, away: number): MatchOutcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function calculatePoints(input: ScoreInput): number {
  const { predictedHome, predictedAway, actualHome, actualAway } = input;

  if (predictedHome === actualHome && predictedAway === actualAway) {
    return SCORING.EXACT;
  }

  const knockoutDraw =
    isKnockoutStage(input.stage) && getOutcome(actualHome, actualAway) === "draw";

  if (knockoutDraw) {
    const predictedOutcome = getOutcome(predictedHome, predictedAway);
    const predictedDraw = predictedOutcome === "draw";

    if (predictedDraw) {
      const winnerHit =
        input.predictedKnockoutWinner &&
        input.actualKnockoutWinner &&
        input.predictedKnockoutWinner === input.actualKnockoutWinner;

      return winnerHit ? SCORING.KNOCKOUT_DRAW_WINNER : SCORING.OUTCOME;
    }

    if (
      input.actualKnockoutWinner &&
      ((predictedOutcome === "home" && input.actualKnockoutWinner === "HOME") ||
        (predictedOutcome === "away" && input.actualKnockoutWinner === "AWAY"))
    ) {
      return SCORING.KNOCKOUT_WINNER_AFTER_REG_DRAW;
    }

    return SCORING.WRONG;
  }

  if (getOutcome(predictedHome, predictedAway) === getOutcome(actualHome, actualAway)) {
    return SCORING.OUTCOME;
  }

  return SCORING.WRONG;
}

/** Okno typowania — max. tyle dni przed rozpoczęciem meczu (tymczasowo 30). */
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
  now: Date = new Date()
): BetBlockReason | null {
  if (status !== "PENDING") return "not_pending";
  if (isMatchLocked(kickoffTime, now)) return "started";
  if (isBettingWindowTooEarly(kickoffTime, now)) return "too_early";
  return null;
}

export function canBetOnMatch(
  status: string,
  kickoffTime: Date,
  now: Date = new Date()
): boolean {
  return getBetBlockReason(status, kickoffTime, now) === null;
}

export function getDashboardMatchSortRank(
  match: { status: string; kickoffTime: Date | string },
  now: Date = new Date()
): number {
  if (match.status === "FINISHED") return 2;
  if (canBetOnMatch(match.status, new Date(match.kickoffTime), now)) return 0;
  return 1;
}

export function sortDashboardMatches<T extends { status: string; kickoffTime: Date | string }>(
  matches: T[],
  options: { finishedTab?: boolean; now?: Date } = {}
): T[] {
  const { finishedTab = false, now = new Date() } = options;

  if (finishedTab) {
    return [...matches].sort(
      (a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime()
    );
  }

  return [...matches].sort((a, b) => {
    const rankA = getDashboardMatchSortRank(a, now);
    const rankB = getDashboardMatchSortRank(b, now);
    if (rankA !== rankB) return rankA - rankB;
    return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  });
}
