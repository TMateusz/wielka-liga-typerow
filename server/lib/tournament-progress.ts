import { MatchStatus } from "@prisma/client";
import { prisma } from "./prisma.js";

export type TournamentProgress = {
  totalMatches: number;
  settledMatches: number;
};

export async function getTournamentProgress(): Promise<TournamentProgress> {
  const [totalMatches, settledMatches] = await Promise.all([
    prisma.match.count(),
    prisma.match.count({
      where: {
        status: MatchStatus.FINISHED,
        homeScore: { not: null },
        awayScore: { not: null },
      },
    }),
  ]);

  return { totalMatches, settledMatches };
}
