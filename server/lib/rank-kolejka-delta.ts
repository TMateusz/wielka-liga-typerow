import { MatchStatus, UserRole } from "@prisma/client";
import { resolveActiveKolejka } from "../../shared/match-kolejka.js";
import { computeTopNRankChange } from "../../shared/rank-progress.js";
import { buildRankMap, sortUsersForRanking, type RankSortUser } from "../../shared/rank-order.js";
import { isExactScorePrediction } from "../../shared/scoring.js";
import { prisma } from "./prisma.js";

export type RankKolejkaDelta = {
  kolejkaKey: string | null;
  kolejkaLabel: string | null;
  /** userId → Δ: ilu graczy z poprzedniej top N wyprzedzono od startu kolejki. */
  deltas: Record<string, number | null>;
};

type LeaderboardUser = RankSortUser;

async function countExactHitsBefore(
  userIds: string[],
  before: Date,
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.prediction.findMany({
    where: {
      userId: { in: userIds },
      match: {
        status: MatchStatus.FINISHED,
        kickoffTime: { lt: before },
      },
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

async function sumPointsBefore(userIds: string[], before: Date): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.prediction.findMany({
    where: {
      userId: { in: userIds },
      pointsEarned: { not: null },
      match: {
        status: MatchStatus.FINISHED,
        kickoffTime: { lt: before },
      },
    },
    select: { userId: true, pointsEarned: true },
  });

  const points = new Map<string, number>();
  for (const row of rows) {
    points.set(row.userId, (points.get(row.userId) ?? 0) + (row.pointsEarned ?? 0));
  }
  return points;
}

export async function buildRankKolejkaDelta(
  sortedUsers: LeaderboardUser[],
  topN: number,
): Promise<RankKolejkaDelta> {
  const matches = await prisma.match.findMany({
    select: { kickoffTime: true, status: true },
    orderBy: { kickoffTime: "asc" },
  });

  const kolejka = resolveActiveKolejka(
    matches.map((m) => ({
      kickoffTime: m.kickoffTime.toISOString(),
      status: m.status,
    })),
  );

  if (!kolejka || sortedUsers.length === 0) {
    return { kolejkaKey: null, kolejkaLabel: null, deltas: {} };
  }

  const userIds = sortedUsers.map((u) => u.id);
  const [baselinePoints, baselineExactHits] = await Promise.all([
    sumPointsBefore(userIds, kolejka.startsAt),
    countExactHitsBefore(userIds, kolejka.startsAt),
  ]);

  const baselineUsers: LeaderboardUser[] = sortedUsers.map((u) => ({
    ...u,
    totalPoints: baselinePoints.get(u.id) ?? 0,
  }));

  const baselineSorted = sortUsersForRanking(baselineUsers, baselineExactHits);
  const baselineRanks = buildRankMap(baselineSorted);
  const currentRanks = buildRankMap(sortedUsers);

  const deltas: Record<string, number | null> = {};
  for (const u of sortedUsers) {
    deltas[u.id] = computeTopNRankChange(u.id, baselineRanks, currentRanks, topN);
  }

  return {
    kolejkaKey: kolejka.key,
    kolejkaLabel: kolejka.label,
    deltas,
  };
}
