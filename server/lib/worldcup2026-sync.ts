import { MatchStatus } from "@prisma/client";
import { translateTeamName } from "../../shared/team-names.js";
import { isDrawScore, isKnockoutStage } from "../../shared/knockout.js";
import {
  parseStoredScorers,
  parseWc2026Scorers,
  serializeScorers,
} from "../../shared/goal-scorers.js";
import {
  needsExternalLiveMinute,
  normalizeLiveClock,
} from "../../shared/live-clock.js";
import { fetchWorldCup2026Games, type Wc2026Game } from "./worldcup2026-api.js";
import { resolveLiveMinute } from "./live-minute-provider.js";
import { reopenMatch, setMatchResult, updateLiveMatchScore } from "./match-service.js";
import { prisma } from "./prisma.js";

export type Wc2026SyncResult = {
  source: "worldcup2026";
  updated: number;
  live: number;
  finalized: number;
  skipped: number;
  errors: string[];
};

let lastSyncAt: Date | null = null;
let lastSyncResult: Wc2026SyncResult | null = null;
let isSyncing = false;

export function getWorldCup2026SyncStatus() {
  return {
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    lastResult: lastSyncResult,
    isSyncing,
    apiUrl: process.env.WORLDCUP2026_API_URL ?? "https://worldcup26.ir",
  };
}

/** Sprowadza nazwę drużyny do formy kanonicznej (PL, bez znaków diakrytycznych/spacji). */
function canonTeam(name: string | null | undefined): string {
  if (!name) return "";
  return translateTeamName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Klucz pary drużyn meczu (gospodarz|gość) w formie kanonicznej. */
function teamPairKey(home: string | null | undefined, away: string | null | undefined): string {
  return `${canonTeam(home)}|${canonTeam(away)}`;
}

/**
 * Dopasowuje mecz z API do lokalnego rekordu. Najpierw po nazwach drużyn
 * (odporne na różną kolejność meczów w API vs terminarzu), a gdy API nie podaje
 * jeszcze nazw (faza pucharowa) — fallback po numerze meczu (id == fixtureNumber).
 */
async function findLocalMatch(game: Wc2026Game, fixtureNumber: number) {
  const apiHome = game.home_team_name_en;
  const apiAway = game.away_team_name_en;

  if (apiHome && apiAway) {
    const pairKey = teamPairKey(apiHome, apiAway);
    const candidates = await prisma.match.findMany({
      where: {
        OR: [
          { homeTeam: translateTeamName(apiHome), awayTeam: translateTeamName(apiAway) },
          { fixtureNumber },
        ],
      },
    });
    const byPair = candidates.find((m) => teamPairKey(m.homeTeam, m.awayTeam) === pairKey);
    if (byPair) return byPair;
  }

  return prisma.match.findFirst({ where: { fixtureNumber } });
}

function parseScore(value: string | null | undefined): number | null {
  if (value == null || value === "null" || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isGameFinished(game: Wc2026Game): boolean {
  return game.finished?.toUpperCase() === "TRUE";
}

function isGameNotStarted(game: Wc2026Game): boolean {
  const elapsed = (game.time_elapsed ?? "").trim().toLowerCase();
  return elapsed.length === 0 || elapsed === "notstarted";
}

function isGameLive(game: Wc2026Game): boolean {
  if (isGameFinished(game)) return false;
  return !isGameNotStarted(game);
}

function isFalseFinish(match: { kickoffTime: Date }, game: Wc2026Game, now = new Date()): boolean {
  return !isGameFinished(game) && isGameNotStarted(game) && match.kickoffTime.getTime() > now.getTime();
}

function canFinalizeFromApi(match: { kickoffTime: Date }, now = new Date()): boolean {
  return match.kickoffTime.getTime() <= now.getTime();
}

function mapGameStatus(game: Wc2026Game): MatchStatus {
  if (isGameFinished(game)) return MatchStatus.FINISHED;
  if (isGameLive(game)) return MatchStatus.LIVE;
  return MatchStatus.PENDING;
}

function getScorersPayload(game: Wc2026Game) {
  return {
    homeScorers: serializeScorers(parseWc2026Scorers(game.home_scorers)),
    awayScorers: serializeScorers(parseWc2026Scorers(game.away_scorers)),
  };
}

function scorersNeedUpdate(
  match: { homeScorers: string | null; awayScorers: string | null },
  game: Wc2026Game,
) {
  const scorers = getScorersPayload(game);
  const localHomeEmpty = parseStoredScorers(match.homeScorers).length === 0;
  const localAwayEmpty = parseStoredScorers(match.awayScorers).length === 0;
  const apiHome = parseWc2026Scorers(game.home_scorers);
  const apiAway = parseWc2026Scorers(game.away_scorers);

  return (
    scorers.homeScorers !== match.homeScorers ||
    scorers.awayScorers !== match.awayScorers ||
    (localHomeEmpty && apiHome.length > 0) ||
    (localAwayEmpty && apiAway.length > 0)
  );
}

/** Uzupełnia strzelców dla meczów FINISHED z API (np. M1 sprzed wdrożenia syncu). */
export async function backfillFinishedScorers(games: Wc2026Game[]): Promise<number> {
  const finished = await prisma.match.findMany({
    where: { status: MatchStatus.FINISHED },
    select: { id: true, fixtureNumber: true, homeTeam: true, awayTeam: true, homeScorers: true, awayScorers: true },
  });

  const byFixture = new Map(
    games
      .map((g) => {
        const n = Number.parseInt(g.id, 10);
        return Number.isFinite(n) ? ([n, g] as const) : null;
      })
      .filter((x): x is [number, Wc2026Game] => x != null),
  );

  const byPair = new Map(
    games
      .filter((g) => g.home_team_name_en && g.away_team_name_en)
      .map((g) => [teamPairKey(g.home_team_name_en, g.away_team_name_en), g] as const),
  );

  let updated = 0;
  for (const match of finished) {
    const game =
      byPair.get(teamPairKey(match.homeTeam, match.awayTeam)) ??
      (match.fixtureNumber != null ? byFixture.get(match.fixtureNumber) : undefined);
    if (!game || !scorersNeedUpdate(match, game)) continue;

    await prisma.match.update({
      where: { id: match.id },
      data: { ...getScorersPayload(game), lastSyncedAt: new Date() },
    });
    updated++;
  }
  return updated;
}

/** Synchronizuje wyniki z worldcup26.ir po numerze meczu (M1–M104). */
export async function syncWorldCup2026Live(): Promise<Wc2026SyncResult> {
  if (isSyncing) {
    return (
      lastSyncResult ?? {
        source: "worldcup2026",
        updated: 0,
        live: 0,
        finalized: 0,
        skipped: 0,
        errors: ["Synchronizacja już trwa"],
      }
    );
  }

  isSyncing = true;
  const result: Wc2026SyncResult = {
    source: "worldcup2026",
    updated: 0,
    live: 0,
    finalized: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const games = await fetchWorldCup2026Games();

    for (const game of games) {
      const fixtureNumber = Number.parseInt(game.id, 10);
      if (!Number.isFinite(fixtureNumber)) continue;

      try {
        await applyGameUpdate(game, fixtureNumber, result);
      } catch (e) {
        result.errors.push(
          `M${fixtureNumber}: ${e instanceof Error ? e.message : "błąd"}`,
        );
      }
    }

    const backfilled = await backfillFinishedScorers(games);
    if (backfilled > 0) {
      result.updated += backfilled;
    }

    lastSyncAt = new Date();
    lastSyncResult = result;
    return result;
  } finally {
    isSyncing = false;
  }
}

async function applyGameUpdate(
  game: Wc2026Game,
  fixtureNumber: number,
  result: Wc2026SyncResult,
) {
  let match = await findLocalMatch(game, fixtureNumber);

  if (!match) {
    result.skipped++;
    return;
  }

  if (match.status === MatchStatus.FINISHED) {
    if (isFalseFinish(match, game)) {
      await reopenMatch(match.id);
      result.updated++;
      result.errors.push(`M${fixtureNumber}: cofnięto błędne rozliczenie przed startem meczu`);
      match = (await prisma.match.findUnique({ where: { id: match.id } }))!;
    } else {
      if (scorersNeedUpdate(match, game)) {
        await prisma.match.update({
          where: { id: match.id },
          data: { ...getScorersPayload(game), lastSyncedAt: new Date() },
        });
        result.updated++;
      }
      return;
    }
  }

  const homeScore = isGameNotStarted(game) ? null : parseScore(game.home_score);
  const awayScore = isGameNotStarted(game) ? null : parseScore(game.away_score);
  const status = mapGameStatus(game);
  let liveClock =
    status === MatchStatus.LIVE ? normalizeLiveClock(game.time_elapsed) : null;

  if (status === MatchStatus.LIVE && needsExternalLiveMinute(game.time_elapsed)) {
    const externalMinute = await resolveLiveMinute({
      homeTeamEn: game.home_team_name_en ?? match.homeTeam,
      awayTeamEn: game.away_team_name_en ?? match.awayTeam,
      kickoffTime: match.kickoffTime,
      fixtureNumber: match.fixtureNumber,
    });
    if (externalMinute) {
      liveClock = externalMinute;
    }
  }

  if (
    status === MatchStatus.FINISHED &&
    homeScore != null &&
    awayScore != null &&
    canFinalizeFromApi(match)
  ) {
    const knockout = isKnockoutStage(match.stage);
    if (knockout && isDrawScore(homeScore, awayScore)) {
      await updateLiveMatchScore(match.id, homeScore, awayScore, null);
      await prisma.match.update({
        where: { id: match.id },
        data: { lastSyncedAt: new Date(), ...getScorersPayload(game) },
      });
      result.updated++;
      result.errors.push(
        `M${fixtureNumber}: remis pucharowy — wpisz zwycięzcę po dogrywce ręcznie w adminie`,
      );
      return;
    }

    await setMatchResult(match.id, homeScore, awayScore);
    await prisma.match.update({
      where: { id: match.id },
      data: { lastSyncedAt: new Date(), ...getScorersPayload(game) },
    });
    result.finalized++;
    result.updated++;
    return;
  }

  if (status === MatchStatus.LIVE && homeScore != null && awayScore != null) {
    result.live++;
    await updateLiveMatchScore(match.id, homeScore, awayScore, liveClock);
    await prisma.match.update({
      where: { id: match.id },
      data: { lastSyncedAt: new Date(), ...getScorersPayload(game) },
    });
    result.updated++;
    return;
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      status,
      homeScore,
      awayScore,
      liveClock: status === MatchStatus.LIVE ? liveClock : null,
      ...getScorersPayload(game),
      lastSyncedAt: new Date(),
    },
  });
  result.updated++;
}
