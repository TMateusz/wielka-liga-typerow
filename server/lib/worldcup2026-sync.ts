import { MatchStatus } from "@prisma/client";
import { isDrawScore, isKnockoutStage } from "../../shared/knockout.js";
import {
  parseStoredScorers,
  parseWc2026Scorers,
  serializeScorers,
} from "../../shared/goal-scorers.js";
import { normalizeLiveClock } from "../../shared/live-clock.js";
import { fetchWorldCup2026Games, type Wc2026Game } from "./worldcup2026-api.js";
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
    select: { id: true, fixtureNumber: true, homeScorers: true, awayScorers: true },
  });

  const byFixture = new Map(
    games
      .map((g) => {
        const n = Number.parseInt(g.id, 10);
        return Number.isFinite(n) ? ([n, g] as const) : null;
      })
      .filter((x): x is [number, Wc2026Game] => x != null),
  );

  let updated = 0;
  for (const match of finished) {
    if (match.fixtureNumber == null) continue;
    const game = byFixture.get(match.fixtureNumber);
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
  let match = await prisma.match.findFirst({
    where: { fixtureNumber },
  });

  if (!match) {
    result.skipped++;
    return;
  }

  if (match.status === MatchStatus.FINISHED) {
    if (isFalseFinish(match, game)) {
      await reopenMatch(match.id);
      result.updated++;
      result.errors.push(`M${fixtureNumber}: cofnięto błędne rozliczenie przed startem meczu`);
      match = (await prisma.match.findFirst({ where: { fixtureNumber } }))!;
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
  const liveClock =
    status === MatchStatus.LIVE ? normalizeLiveClock(game.time_elapsed) : null;

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
