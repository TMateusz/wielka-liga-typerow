import { MatchStatus } from "@prisma/client";
import { localizeMatch } from "../../shared/team-names.js";
import { prisma } from "./prisma.js";

export type LastResultUpdate = {
  at: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

export async function getLastResultUpdate(): Promise<LastResultUpdate | null> {
  const match = await prisma.match.findFirst({
    where: {
      status: MatchStatus.FINISHED,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    orderBy: [{ resultEnteredAt: "desc" }, { updatedAt: "desc" }],
    select: {
      resultEnteredAt: true,
      updatedAt: true,
      homeTeam: true,
      awayTeam: true,
      homeScore: true,
      awayScore: true,
    },
  });

  if (!match || match.homeScore == null || match.awayScore == null) {
    return null;
  }

  const localized = localizeMatch({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
  });

  return {
    at: (match.resultEnteredAt ?? match.updatedAt).toISOString(),
    homeTeam: localized.homeTeam,
    awayTeam: localized.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };
}
