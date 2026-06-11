import { MatchStatus } from "@prisma/client";
import { isDrawScore, isKnockoutStage } from "../../shared/knockout.js";
import { fetchWorldCup2026Games, type Wc2026Game } from "./worldcup2026-api.js";
import { setMatchResult, updateLiveMatchScore } from "./match-service.js";
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

function isGameLive(game: Wc2026Game): boolean {
  if (isGameFinished(game)) return false;
  const elapsed = (game.time_elapsed ?? "").trim().toLowerCase();
  return elapsed.length > 0 && elapsed !== "notstarted";
}

function mapGameStatus(game: Wc2026Game): MatchStatus {
  if (isGameFinished(game)) return MatchStatus.FINISHED;
  if (isGameLive(game)) return MatchStatus.LIVE;
  return MatchStatus.PENDING;
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
  const match = await prisma.match.findFirst({
    where: { fixtureNumber },
  });

  if (!match) {
    result.skipped++;
    return;
  }

  if (match.status === MatchStatus.FINISHED) {
    return;
  }

  const homeScore = parseScore(game.home_score);
  const awayScore = parseScore(game.away_score);
  const status = mapGameStatus(game);

  if (
    status === MatchStatus.FINISHED &&
    homeScore != null &&
    awayScore != null
  ) {
    const knockout = isKnockoutStage(match.stage);
    if (knockout && isDrawScore(homeScore, awayScore)) {
      await updateLiveMatchScore(match.id, homeScore, awayScore);
      await prisma.match.update({
        where: { id: match.id },
        data: { lastSyncedAt: new Date() },
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
      data: { lastSyncedAt: new Date() },
    });
    result.finalized++;
    result.updated++;
    return;
  }

  if (status === MatchStatus.LIVE && homeScore != null && awayScore != null) {
    result.live++;
    await updateLiveMatchScore(match.id, homeScore, awayScore);
    await prisma.match.update({
      where: { id: match.id },
      data: { lastSyncedAt: new Date() },
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
      lastSyncedAt: new Date(),
    },
  });
  result.updated++;
}
