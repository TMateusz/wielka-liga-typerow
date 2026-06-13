import { Match, MatchStatus } from "@prisma/client";
import { isDrawScore, isKnockoutStage, parseKnockoutSide, type KnockoutSide } from "../../shared/knockout.js";
import { calculatePoints } from "../../shared/scoring.js";
import { settleVirtualBetsForMatch } from "./virtual-betting-service.js";
import { rewardAllFinishedPredictionsForMatch } from "./virtual-token-rewards.js";
import { prisma } from "./prisma.js";

type ScoreUpdateOptions = {
  status: MatchStatus;
  knockoutWinner: KnockoutSide | null;
  liveClock?: string | null;
  adminId?: string | null;
  recordHistory?: boolean;
};

async function applyScoreUpdate(
  match: Match,
  homeScore: number,
  awayScore: number,
  options: ScoreUpdateOptions,
) {
  const { status, knockoutWinner, liveClock, adminId, recordHistory } = options;
  const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } });

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
        actualKnockoutWinner: knockoutWinner ?? parseKnockoutSide(match.knockoutWinner),
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
      where: { id: match.id },
      data: {
        homeScore,
        awayScore,
        knockoutWinner: status === MatchStatus.FINISHED ? knockoutWinner : match.knockoutWinner,
        status,
        liveClock:
          status === MatchStatus.FINISHED
            ? null
            : liveClock !== undefined
              ? liveClock
              : match.liveClock,
        ...(status === MatchStatus.FINISHED ? { resultEnteredAt: new Date() } : {}),
      },
    });

    if (recordHistory && adminId) {
      await tx.matchResultHistory.create({
        data: {
          matchId: match.id,
          adminId,
          homeScore,
          awayScore,
          knockoutWinner,
          previousHomeScore: match.homeScore,
          previousAwayScore: match.awayScore,
          previousKnockoutWinner: match.knockoutWinner,
        },
      });
    }
  });
}

/** Aktualizuje wynik na żywo i przelicza punkty względem poprzedniego stanu. */
export async function updateLiveMatchScore(
  matchId: string,
  homeScore: number,
  awayScore: number,
  liveClock?: string | null,
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new Error("Mecz nie istnieje");
  }
  if (match.status === MatchStatus.FINISHED) {
    return;
  }

  const knockout = isKnockoutStage(match.stage);
  const regulationDraw = isDrawScore(homeScore, awayScore);
  const knockoutWinner =
    regulationDraw && knockout ? parseKnockoutSide(match.knockoutWinner) : null;

  await applyScoreUpdate(match, homeScore, awayScore, {
    status: MatchStatus.LIVE,
    knockoutWinner,
    ...(liveClock !== undefined ? { liveClock } : {}),
  });
}

/** Cofa błędne rozliczenie (np. sync przed startem meczu) i zeruje naliczone punkty. */
export async function reopenMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== MatchStatus.FINISHED) {
    return;
  }

  const predictions = await prisma.prediction.findMany({ where: { matchId } });

  await prisma.$transaction(async (tx) => {
    for (const prediction of predictions) {
      const oldPoints = prediction.pointsEarned ?? 0;
      if (oldPoints !== 0) {
        await tx.user.update({
          where: { id: prediction.userId },
          data: { totalPoints: { decrement: oldPoints } },
        });
      }
      await tx.prediction.update({
        where: { id: prediction.id },
        data: { pointsEarned: null },
      });
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.PENDING,
        homeScore: null,
        awayScore: null,
        knockoutWinner: null,
        liveClock: null,
        resultEnteredAt: null,
      },
    });
  });
}

/** Zapisuje lub poprawia wynik meczu i przelicza punkty (różnica vs poprzedni wynik). */
export async function setMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  knockoutWinnerInput?: KnockoutSide | null,
  adminId?: string | null,
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

  await applyScoreUpdate(match, homeScore, awayScore, {
    status: MatchStatus.FINISHED,
    knockoutWinner,
    adminId,
    recordHistory: Boolean(adminId),
  });

  await settleVirtualBetsForMatch(matchId);
  await rewardAllFinishedPredictionsForMatch(matchId);
}
