import { Router } from "express";
import { MatchStatus, UserRole } from "@prisma/client";
import { isExactScorePrediction } from "../../shared/scoring.js";
import { localizeMatch } from "../../shared/team-names.js";
import { getLastResultUpdate } from "../lib/last-result-update.js";
import { getTournamentProgress } from "../lib/tournament-progress.js";
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
router.get("/", async (_req, res) => {
  const [rawUsers, lastResultUpdate, tournamentProgress] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.USER },
      select: userSelect,
    }),
    getLastResultUpdate(),
    getTournamentProgress(),
  ]);

  const exactHits = await countExactHitsByUser(rawUsers.map((u) => u.id));
  const users = [...rawUsers].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const exactDiff = (exactHits.get(b.id) ?? 0) - (exactHits.get(a.id) ?? 0);
    if (exactDiff !== 0) return exactDiff;
    const nameA = `${a.firstName} ${a.lastName}`;
    const nameB = `${b.firstName} ${b.lastName}`;
    return nameA.localeCompare(nameB, "pl");
  });

  res.json({
    users: users.map(serializeUser),
    playerCount: users.length,
    lastResultUpdate,
    tournamentProgress,
  });
});

/** Mecze + typy — ładuj osobno, bo przy ~100 graczach to duży payload. */
router.get("/tips", async (_req, res) => {
  const [matches, predictions] = await Promise.all([
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
