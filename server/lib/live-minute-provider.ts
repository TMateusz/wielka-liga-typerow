import { normalizeExternalLiveClock } from "../../shared/live-clock.js";
import { WC2026_FIXTURES } from "../data/worldcup-2026-fixtures.js";

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const CACHE_TTL_MS = 12_000;

type EspnStatus = {
  displayClock?: string;
  period?: number;
  type?: {
    state?: string;
    detail?: string;
    name?: string;
  };
};

type EspnCompetition = {
  date?: string;
  startDate?: string;
  status?: EspnStatus;
  competitors?: Array<{
    homeAway?: string;
    team?: { displayName?: string; abbreviation?: string };
  }>;
};

type EspnEvent = {
  date?: string;
  competitions?: EspnCompetition[];
};

type CachedScoreboard = {
  fetchedAt: number;
  events: EspnEvent[];
};

const scoreboardCache = new Map<string, CachedScoreboard>();

/** Aliasy nazw drużyn (ESPN ↔ worldcup26 / fixtures). */
const TEAM_TOKENS: Record<string, string[]> = {
  bosnia: ["bosnia", "bih", "herzegovina", "hercegowina"],
  usa: ["usa", "united states", "stany zjednoczone", "america"],
  czech: ["czech", "czechia", "czechy", "republic"],
  turkey: ["turkey", "turkiye", "turcja"],
  korea: ["korea", "south korea"],
  ivory: ["ivory", "ivoire", "cote", "wybrzeze"],
  congo: ["congo", "dr congo", "democratic"],
  cape: ["cape", "verde", "przyladka"],
  curacao: ["curacao", "curacao"],
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
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;

  for (const tokens of Object.values(TEAM_TOKENS)) {
    const aHit = tokens.some((t) => ka.includes(t));
    const bHit = tokens.some((t) => kb.includes(t));
    if (aHit && bHit) return true;
  }

  const aWords = new Set(ka.split(" ").filter((w) => w.length > 2));
  const bWords = new Set(kb.split(" ").filter((w) => w.length > 2));
  for (const w of aWords) {
    if (bWords.has(w)) return true;
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

function kickoffDateKey(kickoffTime: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(kickoffTime);

  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}${m}${d}`;
}

async function fetchScoreboard(dateKey: string): Promise<EspnEvent[]> {
  const cached = scoreboardCache.get(dateKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.events;
  }

  const url = `${ESPN_SCOREBOARD}?dates=${dateKey}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; WielkaLigaTyperow/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`ESPN scoreboard HTTP ${res.status}`);
  }

  const data = (await res.json()) as { events?: EspnEvent[] };
  const events = Array.isArray(data.events) ? data.events : [];
  scoreboardCache.set(dateKey, { fetchedAt: Date.now(), events });
  return events;
}

function extractEspnTeams(comp: EspnCompetition): { home: string; away: string } | null {
  let home: string | null = null;
  let away: string | null = null;

  for (const c of comp.competitors ?? []) {
    const name = c.team?.displayName;
    if (!name) continue;
    if (c.homeAway === "home") home = name;
    if (c.homeAway === "away") away = name;
  }

  if (!home || !away) return null;
  return { home, away };
}

function kickoffDeltaMs(comp: EspnCompetition, kickoffTime: Date): number {
  const raw = comp.startDate ?? comp.date;
  if (!raw) return Number.POSITIVE_INFINITY;
  return Math.abs(new Date(raw).getTime() - kickoffTime.getTime());
}

function extractMinuteFromEspnStatus(status: EspnStatus | undefined): string | null {
  if (!status) return null;

  const state = status.type?.state;
  const detail = (status.type?.detail ?? "").toUpperCase();
  const name = (status.type?.name ?? "").toUpperCase();

  if (detail === "HT" || name.includes("HALFTIME")) {
    return "HT";
  }

  if (state !== "in") {
    return null;
  }

  return normalizeExternalLiveClock(status.displayClock);
}

/**
 * Pobiera minutę meczu z ESPN (Sofascore/Flashscore blokują zapytania serwerowe — 403).
 * Używane wyłącznie do etykiety minuty w UI; wyniki nadal z worldcup26.ir.
 */
export async function resolveLiveMinute(params: {
  homeTeamEn: string;
  awayTeamEn: string;
  kickoffTime: Date;
  fixtureNumber?: number | null;
}): Promise<string | null> {
  const fixtureNames = fixtureEnglishNames(params.fixtureNumber);
  const homeTeam = fixtureNames?.home ?? params.homeTeamEn;
  const awayTeam = fixtureNames?.away ?? params.awayTeamEn;

  const dateKey = kickoffDateKey(params.kickoffTime);
  let events: EspnEvent[];

  try {
    events = await fetchScoreboard(dateKey);
  } catch {
    return null;
  }

  let best: { minute: string; delta: number } | null = null;

  for (const event of events) {
    for (const comp of event.competitions ?? []) {
      const teams = extractEspnTeams(comp);
      if (!teams) continue;

      const homeOk =
        teamsMatch(teams.home, homeTeam) && teamsMatch(teams.away, awayTeam);
      const swappedOk =
        teamsMatch(teams.home, awayTeam) && teamsMatch(teams.away, homeTeam);
      if (!homeOk && !swappedOk) continue;

      const delta = kickoffDeltaMs(comp, params.kickoffTime);
      if (delta > 3 * 60 * 60 * 1000) continue;

      const minute = extractMinuteFromEspnStatus(comp.status);
      if (!minute) continue;

      if (!best || delta < best.delta) {
        best = { minute, delta };
      }
    }
  }

  return best?.minute ?? null;
}
