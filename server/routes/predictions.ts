import { Router } from "express";
import { isKnockoutStage, parseKnockoutSide } from "../../shared/knockout.js";
import { BET_WINDOW_DAYS, canBetOnMatch, getBetBlockReason } from "../../shared/scoring.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { matchId, predictedHomeScore, predictedAwayScore, predictedKnockoutWinner } = req.body;

  if (
    !matchId ||
    typeof predictedHomeScore !== "number" ||
    typeof predictedAwayScore !== "number" ||
    predictedHomeScore < 0 ||
    predictedAwayScore < 0
  ) {
    return res.status(400).json({ error: "Nieprawidłowe dane" });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return res.status(404).json({ error: "Mecz nie istnieje" });
  }

  if (!canBetOnMatch(match.status, match.kickoffTime)) {
    const reason = getBetBlockReason(match.status, match.kickoffTime);
    const error =
      reason === "too_early"
        ? `Typowanie dostępne max. ${BET_WINDOW_DAYS} dni przed meczem`
        : "Typowanie zablokowane — mecz już się rozpoczął";
    return res.status(403).json({ error });
  }

  const knockout = isKnockoutStage(match.stage);
  const knockoutWinner = knockout ? parseKnockoutSide(predictedKnockoutWinner) : null;

  if (knockout && !knockoutWinner) {
    return res.status(400).json({
      error: "W fazie pucharowej wybierz drużynę, która awansuje",
    });
  }

  const [prediction] = await prisma.$transaction([
    prisma.prediction.upsert({
      where: {
        userId_matchId: { userId: req.user!.id, matchId },
      },
      update: {
        predictedHomeScore,
        predictedAwayScore,
        predictedKnockoutWinner: knockoutWinner,
      },
      create: {
        userId: req.user!.id,
        matchId,
        predictedHomeScore,
        predictedAwayScore,
        predictedKnockoutWinner: knockoutWinner,
      },
    }),
    prisma.user.update({
      where: { id: req.user!.id },
      data: { lastActiveAt: new Date() },
    }),
  ]);

  res.json(prediction);
});

export default router;
