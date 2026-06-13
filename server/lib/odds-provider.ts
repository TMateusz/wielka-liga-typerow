import { isPlaceholderMatch } from "../../shared/placeholders.js";
import { toEnglishTeamName } from "../../shared/team-names.js";
import {
  balancedKnockoutOdds,
  oddsFromTeamStrength,
} from "../data/team-strength.js";

export type OddsTriple = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  source: string;
};

export const TEAM_STRENGTH_ODDS_SOURCE = "team-strength";
export const ADMIN_ODDS_SOURCE = "admin-manual";
export const SIMULATOR_ODDS_SOURCE = TEAM_STRENGTH_ODDS_SOURCE;

const LEGACY_SOURCES = new Set([
  "the-odds-api",
  "api-football",
  "simulator-v1",
  "simulator-v2",
  "imported-static-v1",
]);

export function resolveMatchOdds(params: {
  fixtureNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
}): OddsTriple {
  if (isPlaceholderMatch(params.homeTeam, params.awayTeam)) {
    return { ...balancedKnockoutOdds(), source: TEAM_STRENGTH_ODDS_SOURCE };
  }

  const odds = oddsFromTeamStrength(
    toEnglishTeamName(params.homeTeam),
    toEnglishTeamName(params.awayTeam),
  );

  return {
    homeOdds: odds.homeOdds,
    drawOdds: odds.drawOdds,
    awayOdds: odds.awayOdds,
    source: TEAM_STRENGTH_ODDS_SOURCE,
  };
}

export function simulatorOddsNeedRefresh(odds: {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  source: string;
}): boolean {
  if (odds.homeOdds < 1.01 || odds.drawOdds < 1.01 || odds.awayOdds < 1.01) return true;
  if (odds.source === ADMIN_ODDS_SOURCE || odds.source === TEAM_STRENGTH_ODDS_SOURCE) return false;
  return LEGACY_SOURCES.has(odds.source);
}
