import { MatchStatus, UserRole } from "@prisma/client";
import { buildRankMap, sortUsersForRanking } from "../../shared/rank-order.js";
import { isExactScorePrediction } from "../../shared/scoring.js";
import { prisma } from "./prisma.js";

async function countExactHitsByUser(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.prediction.findMany({
    where: {
      userId: { in: userIds },
      match: { status: MatchStatus.FINISHED },
    },
    select: {
      userId: true,
      predictedHomeScore: true,
      predictedAwayScore: true,
      match: { select: { homeScore: true, awayScore: true } },
    },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (
      isExactScorePrediction(
        row.predictedHomeScore,
        row.predictedAwayScore,
        row.match.homeScore,
        row.match.awayScore,
      )
    ) {
      counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Mapa userId → pozycja w rankingu (1 = lider). */
export async function buildUserRankMap(): Promise<Map<string, number>> {
  const rawUsers = await prisma.user.findMany({
    where: { role: UserRole.USER },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      totalPoints: true,
    },
  });

  const exactHits = await countExactHitsByUser(rawUsers.map((u) => u.id));
  return buildRankMap(sortUsersForRanking(rawUsers, exactHits));
}
