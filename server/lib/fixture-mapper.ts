import { MatchStatus } from "@prisma/client";
import type { ApiFixtureItem } from "./api-football.js";

const FINISHED = new Set(["FT", "AET", "PEN"]);
const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);

/** Mapuje status API-Football na status w naszej bazie. */
export function mapApiStatus(short: string): MatchStatus {
  if (FINISHED.has(short)) return MatchStatus.FINISHED;
  if (LIVE.has(short)) return MatchStatus.LIVE;
  return MatchStatus.PENDING;
}

/** Wynik do typowania — pełny czas + dogrywka (bez serii karnych). */
export function extractScores(fixture: ApiFixtureItem): {
  home: number | null;
  away: number | null;
} {
  const ft = fixture.score?.fulltime;
  if (ft?.home != null && ft?.away != null) {
    return { home: ft.home, away: ft.away };
  }
  return {
    home: fixture.goals.home,
    away: fixture.goals.away,
  };
}

export function mapFixtureToMatchData(fixture: ApiFixtureItem) {
  const venue = fixture.fixture.venue;
  const venueLabel = [venue?.name, venue?.city].filter(Boolean).join(", ") || null;

  return {
    apiFootballId: fixture.fixture.id,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    kickoffTime: new Date(fixture.fixture.date),
    stage: fixture.league.round ?? "MŚ 2026",
    venue: venueLabel,
    status: mapApiStatus(fixture.fixture.status.short),
    ...extractScores(fixture),
  };
}
