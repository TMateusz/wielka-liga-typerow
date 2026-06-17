import { Router } from "express";
import { parseStoredScorers } from "../../shared/goal-scorers.js";
import { localizeMatch } from "../../shared/team-names.js";
import { getLastResultUpdate } from "../lib/last-result-update.js";
import { getTournamentProgress } from "../lib/tournament-progress.js";
import { getOutcome } from "../../shared/scoring.js";
import { getDisplayName } from "../../shared/display-names.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const [matches, lastResultUpdate, tournamentProgress] = await Promise.all([
    prisma.match.findMany({
      orderBy: { kickoffTime: "asc" },
      include: {
        predictions: {
          where: { userId: req.user!.id },
        },
      },
    }),
    getLastResultUpdate(),
    getTournamentProgress(),
  ]);

  const liveMatchIds = matches.filter((m) => m.status === "LIVE").map((m) => m.id);

  // For live matches, fetch all predictions to compute community stats
  let liveStatsMap = new Map<string, {
    outcomeDistribution: { home: number; draw: number; away: number };
    exactHitNames: string[];
  }>();

  if (liveMatchIds.length > 0) {
    const allLivePredictions = await prisma.prediction.findMany({
      where: { matchId: { in: liveMatchIds } },
      select: {
        matchId: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        pointsEarned: true,
        user: { select: { firstName: true, lastName: true, nickname: true } },
      },
    });

    for (const matchId of liveMatchIds) {
      const preds = allLivePredictions.filter((p) => p.matchId === matchId);
      let home = 0, draw = 0, away = 0;
      const exactHitNames: string[] = [];

      for (const p of preds) {
        const outcome = getOutcome(p.predictedHomeScore, p.predictedAwayScore);
        if (outcome === "home") home++;
        else if (outcome === "draw") draw++;
        else away++;

        if (p.pointsEarned != null && p.pointsEarned >= 3) {
          exactHitNames.push(getDisplayName(p.user));
        }
      }

      liveStatsMap.set(matchId, {
        outcomeDistribution: { home, draw, away },
        exactHitNames,
      });
    }
  }

  const result = matches.map((m) =>
    localizeMatch({
      id: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      kickoffTime: m.kickoffTime.toISOString(),
      status: m.status,
      liveClock: m.liveClock,
      homeScorers: parseStoredScorers(m.homeScorers),
      awayScorers: parseStoredScorers(m.awayScorers),
      stage: m.stage,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      knockoutWinner: m.knockoutWinner,
      liveStats: liveStatsMap.get(m.id) ?? null,
      prediction: m.predictions[0]
        ? {
            predictedHomeScore: m.predictions[0].predictedHomeScore,
            predictedAwayScore: m.predictions[0].predictedAwayScore,
            predictedKnockoutWinner: m.predictions[0].predictedKnockoutWinner,
            pointsEarned: m.predictions[0].pointsEarned,
          }
        : null,
    })
  );

  res.json({ matches: result, lastResultUpdate, tournamentProgress });
});

export default router;
