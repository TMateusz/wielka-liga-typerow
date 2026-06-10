import { Router } from "express";
import { localizeMatch } from "../../shared/team-names.js";
import { getLastResultUpdate } from "../lib/last-result-update.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const [matches, lastResultUpdate] = await Promise.all([
    prisma.match.findMany({
      orderBy: { kickoffTime: "asc" },
      include: {
        predictions: {
          where: { userId: req.user!.id },
        },
      },
    }),
    getLastResultUpdate(),
  ]);

  const result = matches.map((m) =>
    localizeMatch({
      id: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      kickoffTime: m.kickoffTime.toISOString(),
      status: m.status,
      stage: m.stage,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      knockoutWinner: m.knockoutWinner,
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

  res.json({ matches: result, lastResultUpdate });
});

export default router;
