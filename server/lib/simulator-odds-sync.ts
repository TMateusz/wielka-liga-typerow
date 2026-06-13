import { MatchStatus } from "@prisma/client";
import { isPlaceholderMatch } from "../../shared/placeholders.js";
import { toEnglishTeamName } from "../../shared/team-names.js";
import {
  balancedKnockoutOdds,
  oddsFromTeamStrength,
} from "../data/team-strength.js";
import { ADMIN_ODDS_SOURCE, TEAM_STRENGTH_ODDS_SOURCE, type OddsTriple } from "./odds-provider.js";
import { prisma } from "./prisma.js";

export type SyncSimulatorOddsResult = {
  updated: number;
  skipped: number;
  errors: string[];
};

function oddsForMatch(homeTeam: string, awayTeam: string): OddsTriple {
  if (isPlaceholderMatch(homeTeam, awayTeam)) {
    return { ...balancedKnockoutOdds(), source: TEAM_STRENGTH_ODDS_SOURCE };
  }

  const odds = oddsFromTeamStrength(
    toEnglishTeamName(homeTeam),
    toEnglishTeamName(awayTeam),
  );

  return {
    homeOdds: odds.homeOdds,
    drawOdds: odds.drawOdds,
    awayOdds: odds.awayOdds,
    source: TEAM_STRENGTH_ODDS_SOURCE,
  };
}

/** Kursy z modelu siły drużyn (Elo) — darmowe, spójne z rankingiem FIFA. */
export async function syncSimulatorOdds(): Promise<SyncSimulatorOddsResult> {
  const result: SyncSimulatorOddsResult = { updated: 0, skipped: 0, errors: [] };

  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.PENDING,
      kickoffTime: { gt: new Date() },
    },
  });

  for (const match of matches) {
    try {
      const existing = await prisma.virtualOdds.findUnique({ where: { matchId: match.id } });
      if (existing?.source === ADMIN_ODDS_SOURCE) {
        result.skipped++;
        continue;
      }

      const odds = oddsForMatch(match.homeTeam, match.awayTeam);
      await prisma.virtualOdds.upsert({
        where: { matchId: match.id },
        create: {
          matchId: match.id,
          homeOdds: odds.homeOdds,
          drawOdds: odds.drawOdds,
          awayOdds: odds.awayOdds,
          source: odds.source,
          fetchedAt: new Date(),
        },
        update: {
          homeOdds: odds.homeOdds,
          drawOdds: odds.drawOdds,
          awayOdds: odds.awayOdds,
          source: odds.source,
          fetchedAt: new Date(),
        },
      });
      result.updated++;
    } catch (error) {
      result.skipped++;
      result.errors.push(
        `M${match.fixtureNumber ?? "?"}: ${error instanceof Error ? error.message : "błąd"}`,
      );
    }
  }

  return result;
}
