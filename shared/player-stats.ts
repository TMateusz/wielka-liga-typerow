import {
  isKnockoutStage,
  parseKnockoutSide,
  resolveActualKnockoutWinner,
} from "./knockout.js";
import { calculateRegulationPoints, isExactScorePrediction, SCORING } from "./scoring.js";

export type PlayerStats = {
  settledPredictions: number;
  hitRatePercent: number | null;
  exactHits: number;
  outcomeHits: number;
  advanceHits: number;
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
  predictedHomeScore: number;
  predictedAwayScore: number;
  predictedKnockoutWinner: string | null;
  pointsEarned: number | null;
};

type MatchRow = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  stage: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner: string | null;
};

export function computePlayerStats(
  predictions: PredictionRow[],
  matches: MatchRow[],
): PlayerStats {
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  let exactHits = 0;
  let outcomeHits = 0;
  let advanceHits = 0;
  let wrongHits = 0;
  let bestMatch: PlayerStats["bestMatch"] = null;

  for (const prediction of predictions) {
    const match = matchMap.get(prediction.matchId);
    if (
      !match ||
      match.status !== "FINISHED" ||
      prediction.pointsEarned == null ||
      match.homeScore == null ||
      match.awayScore == null
    ) {
      continue;
    }

    const points = prediction.pointsEarned;

    if (
      isExactScorePrediction(
        prediction.predictedHomeScore,
        prediction.predictedAwayScore,
        match.homeScore,
        match.awayScore,
      )
    ) {
      exactHits++;
    } else if (
      calculateRegulationPoints(
        prediction.predictedHomeScore,
        prediction.predictedAwayScore,
        match.homeScore,
        match.awayScore,
      ) === SCORING.OUTCOME
    ) {
      outcomeHits++;
    }

    if (isKnockoutStage(match.stage)) {
      const actualAdvancer = resolveActualKnockoutWinner(
        match.homeScore,
        match.awayScore,
        parseKnockoutSide(match.knockoutWinner),
      );
      const predictedAdvancer = parseKnockoutSide(prediction.predictedKnockoutWinner);
      if (actualAdvancer && predictedAdvancer && actualAdvancer === predictedAdvancer) {
        advanceHits++;
      }
    }

    if (points <= SCORING.WRONG + 1e-9) wrongHits++;

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

  const settledPredictions = predictions.filter((p) => {
    const m = matchMap.get(p.matchId);
    return m?.status === "FINISHED" && p.pointsEarned != null;
  }).length;

  const hits = settledPredictions - wrongHits;
  const hitRatePercent =
    settledPredictions > 0 ? Math.round((hits / settledPredictions) * 100) : null;

  return {
    settledPredictions,
    hitRatePercent,
    exactHits,
    outcomeHits,
    advanceHits,
    wrongHits,
    bestMatch,
  };
}
