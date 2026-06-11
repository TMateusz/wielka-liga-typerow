import { isMatchLocked } from "./scoring.js";

export type PredictionRow = {
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  predictedKnockoutWinner: string | null;
  pointsEarned: number | null;
};

/** Typ widoczny w API — bez wyniku, gdy ukryty przed startem meczu. */
export type PublicPrediction =
  | (PredictionRow & { concealed?: false })
  | {
      userId: string;
      matchId: string;
      concealed: true;
    };

export function canViewPrediction(
  ownerUserId: string,
  viewerUserId: string | null | undefined,
  kickoffTime: Date,
  now: Date = new Date(),
): boolean {
  if (viewerUserId && ownerUserId === viewerUserId) return true;
  return isMatchLocked(kickoffTime, now);
}

export function toPublicPrediction(
  row: PredictionRow,
  kickoffTime: Date,
  viewerUserId: string | null | undefined,
  now: Date = new Date(),
): PublicPrediction {
  if (canViewPrediction(row.userId, viewerUserId, kickoffTime, now)) {
    return row;
  }
  return { userId: row.userId, matchId: row.matchId, concealed: true };
}
