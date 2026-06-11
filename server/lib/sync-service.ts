import { MatchStatus } from "@prisma/client";
import { translateTeamName } from "../../shared/team-names.js";
import { WC2026_FIXTURES, etToUtc } from "../data/worldcup-2026-fixtures.js";
import {
  fetchFixturesByIds,
  fetchLiveFixtures,
  fetchWorldCupFixtures,
  isApiFootballConfigured,
} from "./api-football.js";
import type { ApiFixtureItem } from "./api-football.js";
import { extractScores, mapApiStatus, mapFixtureToMatchData } from "./fixture-mapper.js";
import { setMatchResult, updateLiveMatchScore } from "./match-service.js";
import { prisma } from "./prisma.js";

export type SyncResult = {
  source: "api" | "static";
  imported: number;
  updated: number;
  finalized: number;
  live: number;
  errors: string[];
};

let lastSyncAt: Date | null = null;
let lastSyncResult: SyncResult | null = null;
let isSyncing = false;
let lastImportSource: "api" | "static" | null = null;

export function getSyncStatus() {
  return {
    configured: isApiFootballConfigured(),
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    lastImportSource,
    lastResult: lastSyncResult,
    isSyncing,
    leagueId: process.env.API_FOOTBALL_LEAGUE_ID ?? "1",
    season: process.env.API_FOOTBALL_SEASON ?? "2026",
    staticFixturesAvailable: WC2026_FIXTURES.length,
    apiNote:
      "Plan darmowy API-Football nie obejmuje sezonu 2026 — terminarz importowany z lokalnej bazy. Live sync zadziała po upgrade planu lub w trakcie turnieju.",
  };
}

/** Import z wbudowanego terminarza (104 mecze MŚ 2026). */
export async function importStaticFixtures(): Promise<SyncResult> {
  const result: SyncResult = {
    source: "static",
    imported: 0,
    updated: 0,
    finalized: 0,
    live: 0,
    errors: [],
  };

  for (const f of WC2026_FIXTURES) {
    try {
      const kickoffTime = etToUtc(f.date, f.timeEt);
      const existing = await prisma.match.findUnique({ where: { fixtureNumber: f.n } });

      if (!existing) {
        await prisma.match.create({
          data: {
            fixtureNumber: f.n,
            homeTeam: translateTeamName(f.home),
            awayTeam: translateTeamName(f.away),
            kickoffTime,
            stage: f.stage,
            venue: f.venue,
            status: MatchStatus.PENDING,
          },
        });
        result.imported++;
      } else if (existing.status === MatchStatus.PENDING) {
        await prisma.match.update({
          where: { id: existing.id },
          data: {
            homeTeam: translateTeamName(f.home),
            awayTeam: translateTeamName(f.away),
            kickoffTime,
            stage: f.stage,
            venue: f.venue,
          },
        });
        result.updated++;
      }
    } catch (e) {
      result.errors.push(`Mecz #${f.n}: ${e instanceof Error ? e.message : "błąd"}`);
    }
  }

  // Usuń stare przykładowe mecze bez numeru fixture (sprzed importu MŚ 2026)
  await prisma.match.deleteMany({ where: { fixtureNumber: null } });

  const validFixtureNumbers = WC2026_FIXTURES.map((f) => f.n);
  await prisma.match.deleteMany({
    where: { fixtureNumber: { notIn: validFixtureNumbers } },
  });

  lastSyncAt = new Date();
  lastSyncResult = result;
  lastImportSource = "static";
  return result;
}

/** Importuje terminarz — najpierw API, przy błędzie planu → lokalny terminarz. */
export async function importWorldCupFixtures(): Promise<SyncResult> {
  if (isApiFootballConfigured()) {
    try {
      const fixtures = await fetchWorldCupFixtures();
      const result: SyncResult = {
        source: "api",
        imported: 0,
        updated: 0,
        finalized: 0,
        live: 0,
        errors: [],
      };

      for (const fixture of fixtures) {
        try {
          await upsertApiFixture(fixture, result, { allowFinalize: false });
        } catch (e) {
          result.errors.push(
            `Mecz ${fixture.fixture.id}: ${e instanceof Error ? e.message : "błąd"}`
          );
        }
      }

      lastSyncAt = new Date();
      lastSyncResult = result;
      lastImportSource = "api";
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("season") || msg.includes("Free plans")) {
        console.log("[Import] API niedostępne dla 2026 — używam lokalnego terminarza.");
        return importStaticFixtures();
      }
      throw e;
    }
  }

  return importStaticFixtures();
}

/** Synchronizuje wyniki z API-Football (wymaga płatnego planu dla sezonu 2026). */
export async function syncMatchResults(): Promise<SyncResult> {
  if (!isApiFootballConfigured()) {
    throw new Error("Brak klucza API_FOOTBALL_KEY");
  }

  if (isSyncing) {
    throw new Error("Synchronizacja już trwa");
  }

  isSyncing = true;
  const result: SyncResult = {
    source: "api",
    imported: 0,
    updated: 0,
    finalized: 0,
    live: 0,
    errors: [],
  };

  try {
    const liveFixtures = await fetchLiveFixtures();
    const liveIds = new Set(liveFixtures.map((f) => f.fixture.id));

    for (const fixture of liveFixtures) {
      try {
        await applyApiFixtureUpdate(fixture, result, { allowFinalize: true });
        result.live++;
      } catch (e) {
        result.errors.push(
          `Live ${fixture.fixture.id}: ${e instanceof Error ? e.message : "błąd"}`
        );
      }
    }

    const now = new Date();
    const recentMatches = await prisma.match.findMany({
      where: {
        apiFootballId: { not: null },
        status: { not: MatchStatus.FINISHED },
        kickoffTime: { lte: new Date(now.getTime() + 3 * 60 * 60 * 1000) },
      },
      select: { apiFootballId: true },
    });

    const idsToFetch = recentMatches
      .map((m) => m.apiFootballId!)
      .filter((id) => !liveIds.has(id));

    if (idsToFetch.length > 0) {
      const fixtures = await fetchFixturesByIds(idsToFetch);
      for (const fixture of fixtures) {
        try {
          await applyApiFixtureUpdate(fixture, result, { allowFinalize: true });
        } catch (e) {
          result.errors.push(
            `Sync ${fixture.fixture.id}: ${e instanceof Error ? e.message : "błąd"}`
          );
        }
      }
    }

    lastSyncAt = new Date();
    lastSyncResult = result;
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("season") || msg.includes("Free plans")) {
      result.errors.push("Plan darmowy nie obsługuje sezonu 2026 — wyniki wpisuj ręcznie w panelu Admin.");
      lastSyncAt = new Date();
      lastSyncResult = result;
      return result;
    }
    throw e;
  } finally {
    isSyncing = false;
  }
}

async function upsertApiFixture(
  fixture: ApiFixtureItem,
  result: SyncResult,
  opts: { allowFinalize: boolean }
) {
  const data = mapFixtureToMatchData(fixture);
  const existing = await prisma.match.findUnique({
    where: { apiFootballId: fixture.fixture.id },
  });

  if (!existing) {
    await prisma.match.create({
      data: {
        apiFootballId: data.apiFootballId,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        kickoffTime: data.kickoffTime,
        stage: data.stage,
        venue: data.venue,
        status: MatchStatus.PENDING,
        lastSyncedAt: new Date(),
      },
    });
    result.imported++;
    return;
  }

  if (existing.status === MatchStatus.FINISHED) return;

  await applyApiFixtureUpdate(fixture, result, opts);
}

async function applyApiFixtureUpdate(
  fixture: ApiFixtureItem,
  result: SyncResult,
  opts: { allowFinalize: boolean }
) {
  const apiId = fixture.fixture.id;
  const existing = await prisma.match.findUnique({ where: { apiFootballId: apiId } });

  if (!existing) {
    await upsertApiFixture(fixture, result, opts);
    return;
  }

  if (existing.status === MatchStatus.FINISHED) return;

  const status = mapApiStatus(fixture.fixture.status.short);
  const scores = extractScores(fixture);
  const data = mapFixtureToMatchData(fixture);

  if (
    opts.allowFinalize &&
    status === MatchStatus.FINISHED &&
    scores.home != null &&
    scores.away != null
  ) {
    await setMatchResult(existing.id, scores.home, scores.away);
    await prisma.match.update({
      where: { id: existing.id },
      data: {
        kickoffTime: data.kickoffTime,
        stage: data.stage,
        venue: data.venue,
        lastSyncedAt: new Date(),
      },
    });
    result.finalized++;
    result.updated++;
    return;
  }

  if (
    status === MatchStatus.LIVE &&
    scores.home != null &&
    scores.away != null
  ) {
    result.live++;
    await updateLiveMatchScore(existing.id, scores.home, scores.away);
    await prisma.match.update({
      where: { id: existing.id },
      data: {
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        kickoffTime: data.kickoffTime,
        stage: data.stage,
        venue: data.venue,
        lastSyncedAt: new Date(),
      },
    });
    result.updated++;
    return;
  }

  await prisma.match.update({
    where: { id: existing.id },
    data: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      kickoffTime: data.kickoffTime,
      stage: data.stage,
      venue: data.venue,
      status,
      homeScore: scores.home,
      awayScore: scores.away,
      lastSyncedAt: new Date(),
    },
  });
  result.updated++;
}
