import { MatchStatus } from "@prisma/client";
import { isDrawScore, isKnockoutStage, parseKnockoutSide, type KnockoutSide } from "../../shared/knockout.js";
import { calculatePoints } from "../../shared/scoring.js";
import { prisma } from "./prisma.js";

/** Zapisuje lub poprawia wynik meczu i przelicza punkty (różnica vs poprzedni wynik). */
export async function setMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  knockoutWinnerInput?: KnockoutSide | null
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new Error("Mecz nie istnieje");
  }

  const knockout = isKnockoutStage(match.stage);
  const regulationDraw = isDrawScore(homeScore, awayScore);
  const knockoutWinner = regulationDraw && knockout ? parseKnockoutSide(knockoutWinnerInput) : null;

  if (knockout && regulationDraw && !knockoutWinner) {
    throw new Error("Przy remisie w fazie pucharowej podaj zwycięzcę po dogrywce");
  }

  const predictions = await prisma.prediction.findMany({ where: { matchId } });

  await prisma.$transaction(async (tx) => {
    for (const prediction of predictions) {
      const oldPoints = prediction.pointsEarned ?? 0;
      const newPoints = calculatePoints({
        predictedHome: prediction.predictedHomeScore,
        predictedAway: prediction.predictedAwayScore,
        actualHome: homeScore,
        actualAway: awayScore,
        stage: match.stage,
        predictedKnockoutWinner: parseKnockoutSide(prediction.predictedKnockoutWinner),
        actualKnockoutWinner: knockoutWinner,
      });

      const diff = newPoints - oldPoints;

      if (Math.abs(diff) > 1e-9 || prediction.pointsEarned === null) {
        await tx.prediction.update({
          where: { id: prediction.id },
          data: { pointsEarned: newPoints },
        });

        if (Math.abs(diff) > 1e-9) {
          await tx.user.update({
            where: { id: prediction.userId },
            data: { totalPoints: { increment: diff } },
          });
        }
      }
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        knockoutWinner,
        status: MatchStatus.FINISHED,
        resultEnteredAt: new Date(),
      },
    });
  });
}
