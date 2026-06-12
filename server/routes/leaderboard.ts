import { Router } from "express";
import { MatchStatus, UserRole } from "@prisma/client";
import { RANKING_TOP_N } from "../../shared/league-limits.js";
import { toPublicPrediction } from "../../shared/prediction-privacy.js";
import { sortUsersForRanking } from "../../shared/rank-order.js";
import { isExactScorePrediction } from "../../shared/scoring.js";
import { localizeMatch } from "../../shared/team-names.js";
import { getLastResultUpdate } from "../lib/last-result-update.js";
import { buildRankKolejkaDelta } from "../lib/rank-kolejka-delta.js";
import { getTournamentProgress } from "../lib/tournament-progress.js";
import { countOnlineUsers, ONLINE_THRESHOLD_MS } from "../../shared/online-presence.js";
import { optionalAuth } from "../middleware/auth.js";
import { touchUserActivity } from "../lib/user-activity.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

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

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  nickname: true,
  totalPoints: true,
  lastActiveAt: true,
} as const;

function serializeUser<T extends { lastActiveAt: Date }>(user: T) {
  return {
    ...user,
    lastActiveAt: user.lastActiveAt.toISOString(),
  };
}

const matchSelect = {
  id: true,
  homeTeam: true,
  awayTeam: true,
  homeScore: true,
  awayScore: true,
  knockoutWinner: true,
  status: true,
  kickoffTime: true,
  stage: true,
} as const;

/** Lekki ranking — sama klasyfikacja graczy. */
router.get("/", optionalAuth, async (req, res) => {
  if (req.user) void touchUserActivity(req.user.id);

  const [rawUsers, lastResultUpdate, tournamentProgress] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.USER },
      select: userSelect,
    }),
    getLastResultUpdate(),
    getTournamentProgress(),
  ]);

  const exactHits = await countExactHitsByUser(rawUsers.map((u) => u.id));
  const users = sortUsersForRanking(rawUsers, exactHits);

  const rankKolejkaDelta = await buildRankKolejkaDelta(users, RANKING_TOP_N);

  const now = new Date();
  res.json({
    users: users.map(serializeUser),
    playerCount: users.length,
    onlineCount: countOnlineUsers(users, now),
    onlineThresholdMinutes: ONLINE_THRESHOLD_MS / 60_000,
    lastResultUpdate,
    tournamentProgress,
    rankKolejkaDelta,
  });
});

/** Mecze + typy — cudze typy ukryte w JSON do startu meczu (nie tylko w UI). */
router.get("/tips", optionalAuth, async (req, res) => {
  const viewerUserId = req.user?.id ?? null;
  const now = new Date();

  const [matches, rawPredictions] = await Promise.all([
    prisma.match.findMany({
      orderBy: { kickoffTime: "asc" },
      select: matchSelect,
    }),
    prisma.prediction.findMany({
      where: { user: { role: UserRole.USER } },
      select: {
        userId: true,
        matchId: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        predictedKnockoutWinner: true,
        pointsEarned: true,
      },
    }),
  ]);

  const kickoffByMatchId = new Map(matches.map((m) => [m.id, m.kickoffTime]));
  const predictions = rawPredictions.map((row) => {
    const kickoffTime = kickoffByMatchId.get(row.matchId);
    if (!kickoffTime) {
      return { userId: row.userId, matchId: row.matchId, concealed: true as const };
    }
    return toPublicPrediction(row, kickoffTime, viewerUserId, now);
  });

  res.json({
    matches: matches.map((m) =>
      localizeMatch({
        ...m,
        kickoffTime: m.kickoffTime.toISOString(),
      })
    ),
    predictions,
  });
});

export default router;
