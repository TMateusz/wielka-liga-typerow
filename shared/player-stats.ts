import { SCORING } from "./scoring.js";

export type PlayerStats = {
  settledPredictions: number;
  hitRatePercent: number | null;
  exactHits: number;
  outcomeHits: number;
  knockoutDrawWinnerHits: number;
  knockoutHalfHits: number;
  wrongHits: number;
  bestMatch: {
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    stage: string | null;
    points: number;
  } | null;
};

type PredictionRow = {
  matchId: string;
  pointsEarned: number | null;
};

type MatchRow = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  stage: string | null;
  status: string;
};

export function computePlayerStats(
  predictions: PredictionRow[],
  matches: MatchRow[]
): PlayerStats {
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  let exactHits = 0;
  let outcomeHits = 0;
  let knockoutDrawWinnerHits = 0;
  let knockoutHalfHits = 0;
  let wrongHits = 0;
  let bestMatch: PlayerStats["bestMatch"] = null;

  for (const prediction of predictions) {
    const match = matchMap.get(prediction.matchId);
    if (!match || match.status !== "FINISHED" || prediction.pointsEarned == null) continue;

    const points = prediction.pointsEarned;

    if (points >= SCORING.EXACT - 1e-9 && points <= SCORING.EXACT + 1e-9) exactHits++;
    else if (points >= SCORING.KNOCKOUT_DRAW_WINNER - 1e-9 && points <= SCORING.KNOCKOUT_DRAW_WINNER + 1e-9)
      knockoutDrawWinnerHits++;
    else if (points >= SCORING.OUTCOME - 1e-9 && points <= SCORING.OUTCOME + 1e-9) outcomeHits++;
    else if (
      points >= SCORING.KNOCKOUT_WINNER_AFTER_REG_DRAW - 1e-9 &&
      points <= SCORING.KNOCKOUT_WINNER_AFTER_REG_DRAW + 1e-9
    )
      knockoutHalfHits++;
    else wrongHits++;

    if (!bestMatch || points > bestMatch.points) {
      bestMatch = {
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        stage: match.stage,
        points,
      };
    }
  }

  const settledPredictions =
    exactHits + outcomeHits + knockoutDrawWinnerHits + knockoutHalfHits + wrongHits;
  const hits = settledPredictions - wrongHits;
  const hitRatePercent =
    settledPredictions > 0 ? Math.round((hits / settledPredictions) * 100) : null;

  return {
    settledPredictions,
    hitRatePercent,
    exactHits,
    outcomeHits,
    knockoutDrawWinnerHits,
    knockoutHalfHits,
    wrongHits,
    bestMatch,
  };
}
