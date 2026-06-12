import { MatchStatus } from "@prisma/client";
import { resolveDeltaReferenceMatch } from "../../shared/match-kolejka.js";
import { computeRankChange } from "../../shared/rank-progress.js";
import { buildRankMap, sortUsersForRanking, type RankSortUser } from "../../shared/rank-order.js";
import { isExactScorePrediction } from "../../shared/scoring.js";
import { prisma } from "./prisma.js";

export type RankKolejkaDelta = {
  kolejkaKey: string | null;
  kolejkaLabel: string | null;
  hasLiveMatch: boolean;
  /** userId → Δ pozycji vs stan przed meczem odniesienia (dodatnie = awans). */
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
): Promise<RankKolejkaDelta> {
  const matches = await prisma.match.findMany({
    select: {
      kickoffTime: true,
      status: true,
      fixtureNumber: true,
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: { kickoffTime: "asc" },
  });

  const reference = resolveDeltaReferenceMatch(
    matches.map((m) => ({
      kickoffTime: m.kickoffTime.toISOString(),
      status: m.status,
      fixtureNumber: m.fixtureNumber,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
    })),
  );

  if (!reference || sortedUsers.length === 0) {
    return { kolejkaKey: null, kolejkaLabel: null, hasLiveMatch: false, deltas: {} };
  }

  const userIds = sortedUsers.map((u) => u.id);
  const [baselinePoints, baselineExactHits] = await Promise.all([
    sumPointsBefore(userIds, reference.beforeKickoff),
    countExactHitsBefore(userIds, reference.beforeKickoff),
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
    const prev = baselineRanks.get(u.id);
    const curr = currentRanks.get(u.id);
    deltas[u.id] =
      prev === undefined || curr === undefined ? null : computeRankChange(prev, curr);
  }

  return {
    kolejkaKey: reference.matchKey,
    kolejkaLabel: reference.matchLabel,
    hasLiveMatch: reference.isLive,
    deltas,
  };
}
