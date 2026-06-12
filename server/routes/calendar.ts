import { Router } from "express";
import { parseStoredScorers } from "../../shared/goal-scorers.js";
import { localizeMatch } from "../../shared/team-names.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  const matches = await prisma.match.findMany({
    orderBy: { kickoffTime: "asc" },
    select: {
      id: true,
      fixtureNumber: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      status: true,
      stage: true,
      venue: true,
      homeScore: true,
      awayScore: true,
      liveClock: true,
      homeScorers: true,
      awayScorers: true,
    },
  });

  res.json({
    matches: matches.map((m) =>
      localizeMatch({
        ...m,
        kickoffTime: m.kickoffTime.toISOString(),
        homeScorers: parseStoredScorers(m.homeScorers),
        awayScorers: parseStoredScorers(m.awayScorers),
      }),
    ),
  });
});

export default router;
