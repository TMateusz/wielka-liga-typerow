import { Router } from "express";
import { UserRole } from "@prisma/client";
import { localizeMatch } from "../../shared/team-names.js";
import { getLastResultUpdate } from "../lib/last-result-update.js";
import { prisma } from "../lib/prisma.js";
const router = Router();

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
  status: true,
  kickoffTime: true,
  stage: true,
} as const;

/** Lekki ranking — sama klasyfikacja graczy. */
router.get("/", async (_req, res) => {
  const [users, lastResultUpdate] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.USER },
      orderBy: [{ totalPoints: "desc" }, { firstName: "asc" }, { lastName: "asc" }],
      select: userSelect,
    }),
    getLastResultUpdate(),
  ]);

  res.json({
    users: users.map(serializeUser),
    playerCount: users.length,
    lastResultUpdate,
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
