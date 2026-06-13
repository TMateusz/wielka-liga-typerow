import { WC2026_FIXTURES } from "../data/worldcup-2026-fixtures.js";

export type OddsTriple = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  source: string;
};

type OddsApiOutcome = { name: string; price: number };
type OddsApiMarket = { key: string; outcomes: OddsApiOutcome[] };
type OddsApiBookmaker = { markets: OddsApiMarket[] };
type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
};

const SPORT_KEYS = [
  "soccer_fifa_world_cup",
  "soccer_fifa_world_cup_winner",
  "soccer",
];

const TEAM_TOKENS: Record<string, string[]> = {
  bosnia: ["bosnia", "bih", "herzegovina", "hercegowina"],
  usa: ["usa", "united states", "stany zjednoczone"],
  czech: ["czech", "czechia", "czechy"],
  turkey: ["turkey", "turkiye", "turcja"],
  korea: ["korea", "south korea"],
  ivory: ["ivory", "ivoire", "cote", "wybrzeze"],
  congo: ["congo", "democratic"],
  cape: ["cape", "verde", "przyladka"],
};

function teamKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  const ka = teamKey(a);
  const kb = teamKey(b);
  if (!ka || !kb) return false;
  if (ka === kb || ka.includes(kb) || kb.includes(ka)) return true;

  for (const tokens of Object.values(TEAM_TOKENS)) {
    if (tokens.some((t) => ka.includes(t)) && tokens.some((t) => kb.includes(t))) {
      return true;
    }
  }

  const aWords = new Set(ka.split(" ").filter((w) => w.length > 2));
  for (const w of kb.split(" ").filter((w) => w.length > 2)) {
    if (aWords.has(w)) return true;
  }
  return false;
}

function fixtureEnglishNames(fixtureNumber: number | null | undefined): {
  home: string;
  away: string;
} | null {
  if (fixtureNumber == null) return null;
  const fixture = WC2026_FIXTURES.find((f) => f.n === fixtureNumber);
  if (!fixture) return null;
  return { home: fixture.home, away: fixture.away };
}

/** Kursy symulowane — deterministyczne, gdy brak klucza API lub brak dopasowania. */
export function generateSimulatorOdds(fixtureNumber: number): OddsTriple {
  const seed = fixtureNumber * 7919 + 104;
  const homeRaw = 1.45 + (seed % 23) / 10;
  const awayRaw = 1.55 + ((seed * 3) % 27) / 10;
  const drawRaw = 2.75 + ((seed * 7) % 18) / 10;

  const inv = 1 / homeRaw + 1 / drawRaw + 1 / awayRaw;
  const margin = 1.08;

  return {
    homeOdds: Math.round((margin / (homeRaw * inv)) * 100) / 100,
    drawOdds: Math.round((margin / (drawRaw * inv)) * 100) / 100,
    awayOdds: Math.round((margin / (awayRaw * inv)) * 100) / 100,
    source: "simulator",
  };
}

function extractH2hOdds(
  event: OddsApiEvent,
  homeTeam: string,
  awayTeam: string,
): OddsTriple | null {
  const bookmaker = event.bookmakers?.[0];
  const market = bookmaker?.markets?.find((m) => m.key === "h2h");
  if (!market) return null;

  let homeOdds: number | null = null;
  let drawOdds: number | null = null;
  let awayOdds: number | null = null;

  for (const outcome of market.outcomes) {
    const name = outcome.name;
    if (name.toLowerCase() === "draw") {
      drawOdds = outcome.price;
    } else if (teamsMatch(name, homeTeam)) {
      homeOdds = outcome.price;
    } else if (teamsMatch(name, awayTeam)) {
      awayOdds = outcome.price;
    }
  }

  if (homeOdds == null || drawOdds == null || awayOdds == null) return null;

  return {
    homeOdds,
    drawOdds,
    awayOdds,
    source: "the-odds-api",
  };
}

async function fetchOddsApiEvents(sportKey: string, apiKey: string): Promise<OddsApiEvent[]> {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("regions", "eu");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`The Odds API HTTP ${res.status}`);
  }

  const data = (await res.json()) as OddsApiEvent[];
  return Array.isArray(data) ? data : [];
}

function kickoffDeltaMs(event: OddsApiEvent, kickoffTime: Date): number {
  return Math.abs(new Date(event.commence_time).getTime() - kickoffTime.getTime());
}

async function fetchFromOddsApi(params: {
  homeTeamEn: string;
  awayTeamEn: string;
  kickoffTime: Date;
}): Promise<OddsTriple | null> {
  const apiKey = process.env.ODDS_API_KEY?.trim();
  if (!apiKey) return null;

  let best: { odds: OddsTriple; delta: number } | null = null;

  for (const sportKey of SPORT_KEYS) {
    try {
      const events = await fetchOddsApiEvents(sportKey, apiKey);
      for (const event of events) {
        const homeOk =
          teamsMatch(event.home_team, params.homeTeamEn) &&
          teamsMatch(event.away_team, params.awayTeamEn);
        const swappedOk =
          teamsMatch(event.home_team, params.awayTeamEn) &&
          teamsMatch(event.away_team, params.homeTeamEn);
        if (!homeOk && !swappedOk) continue;

        const delta = kickoffDeltaMs(event, params.kickoffTime);
        if (delta > 6 * 60 * 60 * 1000) continue;

        const odds = extractH2hOdds(
          event,
          swappedOk ? params.awayTeamEn : params.homeTeamEn,
          swappedOk ? params.homeTeamEn : params.awayTeamEn,
        );
        if (!odds) continue;

        if (!best || delta < best.delta) {
          best = { odds, delta };
        }
      }
      if (best) return best.odds;
    } catch {
      continue;
    }
  }

  return null;
}

/** Pobiera kursy 1X2 — raz na mecz; API (The Odds API) albo kursy symulowane. */
export async function resolveMatchOdds(params: {
  fixtureNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
}): Promise<OddsTriple> {
  const english = fixtureEnglishNames(params.fixtureNumber);
  const homeTeamEn = english?.home ?? params.homeTeam;
  const awayTeamEn = english?.away ?? params.awayTeam;

  const fromApi = await fetchFromOddsApi({
    homeTeamEn,
    awayTeamEn,
    kickoffTime: params.kickoffTime,
  });
  if (fromApi) return fromApi;

  if (params.fixtureNumber != null) {
    return generateSimulatorOdds(params.fixtureNumber);
  }

  return {
    homeOdds: 2.1,
    drawOdds: 3.2,
    awayOdds: 3.4,
    source: "simulator",
  };
}
