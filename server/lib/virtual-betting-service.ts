import { MatchStatus, VirtualBetSelection, VirtualBetStatus } from "@prisma/client";
import {
  SIMULATOR_INITIAL_BALANCE,
  SIMULATOR_MAX_STAKE,
  SIMULATOR_MIN_STAKE,
  ACTIVITY_EARNING_RULES,
  type VirtualBetSelection as Selection,
} from "../../shared/simulator.js";
import { localizeMatch } from "../../shared/team-names.js";
import { resolveMatchOdds, simulatorOddsNeedRefresh } from "./odds-provider.js";
import { prisma } from "./prisma.js";

export async function getOrCreateWallet(userId: string) {
  const existing = await prisma.virtualWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.virtualWallet.create({
    data: { userId, balance: SIMULATOR_INITIAL_BALANCE },
  });
}

function oddsLookInvalid(odds: {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  source: string;
  fetchedAt: Date;
}): boolean {
  return simulatorOddsNeedRefresh(odds);
}

export async function ensureOddsForMatch(matchId: string) {
  const existing = await prisma.virtualOdds.findUnique({ where: { matchId } });
  if (existing && !oddsLookInvalid(existing)) return existing;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Nie znaleziono meczu");

  const odds = resolveMatchOdds({
    fixtureNumber: match.fixtureNumber,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoffTime: match.kickoffTime,
  });

  return prisma.virtualOdds.upsert({
    where: { matchId },
    create: {
      matchId,
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
}

function oddsForSelection(
  selection: Selection,
  odds: { homeOdds: number; drawOdds: number; awayOdds: number },
): number {
  if (selection === "HOME") return odds.homeOdds;
  if (selection === "DRAW") return odds.drawOdds;
  return odds.awayOdds;
}

function winningSelection(
  homeScore: number,
  awayScore: number,
): VirtualBetSelection {
  if (homeScore > awayScore) return VirtualBetSelection.HOME;
  if (awayScore > homeScore) return VirtualBetSelection.AWAY;
  return VirtualBetSelection.DRAW;
}

export async function placeVirtualBet(params: {
  userId: string;
  matchId: string;
  selection: Selection;
  stake: number;
}) {
  const { userId, matchId, selection, stake } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasAcceptedSimulatorTerms: true },
  });
  if (!user?.hasAcceptedSimulatorTerms) {
    throw new Error("Musisz zaakceptować regulamin gry towarzyskiej");
  }

  if (!Number.isInteger(stake) || stake < SIMULATOR_MIN_STAKE) {
    throw new Error(`Minimum: ${SIMULATOR_MIN_STAKE} pkt aktywności`);
  }
  if (stake > SIMULATOR_MAX_STAKE) {
    throw new Error(`Maksimum: ${SIMULATOR_MAX_STAKE} pkt aktywności`);
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Nie znaleziono meczu");
  if (match.status !== MatchStatus.PENDING) {
    throw new Error("Typy bonusowe można zapisywać tylko przed rozpoczęciem meczu");
  }
  if (match.kickoffTime.getTime() <= Date.now()) {
    throw new Error("Mecz już się rozpoczął");
  }

  const existingBet = await prisma.virtualBet.findUnique({
    where: { userId_matchId: { userId, matchId } },
  });
  if (existingBet) {
    throw new Error("Masz już typ bonusowy na ten mecz");
  }

  const oddsRow = await ensureOddsForMatch(matchId);
  const odds = oddsForSelection(selection, oddsRow);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.virtualWallet.findUnique({ where: { userId } });
    const balance = wallet?.balance ?? SIMULATOR_INITIAL_BALANCE;

    if (stake > balance) {
      throw new Error("Za mało punktów aktywności");
    }

    if (wallet) {
      await tx.virtualWallet.update({
        where: { userId },
        data: { balance: balance - stake },
      });
    } else {
      if (stake > SIMULATOR_INITIAL_BALANCE) {
        throw new Error("Za mało punktów aktywności");
      }
      await tx.virtualWallet.create({
        data: { userId, balance: SIMULATOR_INITIAL_BALANCE - stake },
      });
    }

    return tx.virtualBet.create({
      data: {
        userId,
        matchId,
        selection: selection as VirtualBetSelection,
        stake,
        odds,
      },
    });
  });
}

export async function settleVirtualBetsForMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== MatchStatus.FINISHED) return 0;
  if (match.homeScore == null || match.awayScore == null) return 0;

  const pending = await prisma.virtualBet.findMany({
    where: { matchId, status: VirtualBetStatus.PENDING },
  });
  if (pending.length === 0) return 0;

  const winner = winningSelection(match.homeScore, match.awayScore);
  const now = new Date();
  let settled = 0;

  for (const bet of pending) {
    const won = bet.selection === winner;
    const payout = won ? Math.floor(bet.stake * bet.odds) : 0;

    await prisma.$transaction(async (tx) => {
      await tx.virtualBet.update({
        where: { id: bet.id },
        data: {
          status: won ? VirtualBetStatus.WON : VirtualBetStatus.LOST,
          payout: won ? payout : 0,
          settledAt: now,
        },
      });

      if (won && payout > 0) {
        const wallet = await tx.virtualWallet.findUnique({ where: { userId: bet.userId } });
        if (wallet) {
          await tx.virtualWallet.update({
            where: { userId: bet.userId },
            data: { balance: wallet.balance + payout },
          });
        } else {
          await tx.virtualWallet.create({
            data: { userId: bet.userId, balance: SIMULATOR_INITIAL_BALANCE + payout },
          });
        }
      }
    });

    settled++;
  }

  return settled;
}

export async function getSimulatorState(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  const now = new Date();

  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.PENDING,
      kickoffTime: { gt: now },
    },
    orderBy: { kickoffTime: "asc" },
    take: 30,
  });

  const matchIds = matches.map((m) => m.id);
  const [oddsRows, userBets] = await Promise.all([
    prisma.virtualOdds.findMany({ where: { matchId: { in: matchIds } } }),
    prisma.virtualBet.findMany({
      where: { userId },
      include: { match: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const oddsByMatch = new Map(oddsRows.map((o) => [o.matchId, o]));
  const userBetByMatch = new Map(
    userBets.filter((b) => b.status === VirtualBetStatus.PENDING).map((b) => [b.matchId, b]),
  );

  const needsOddsRefresh = matches.filter((m) => {
    const odds = oddsByMatch.get(m.id);
    return !odds || oddsLookInvalid(odds);
  });
  for (const m of needsOddsRefresh) {
    try {
      const row = await ensureOddsForMatch(m.id);
      oddsByMatch.set(m.id, row);
    } catch {
      /* ignore — UI pokaże brak kursów */
    }
  }

  const bettableMatches = matches.map((m) => {
    const localized = localizeMatch(m);
    const odds = oddsByMatch.get(m.id);
    return {
      id: m.id,
      fixtureNumber: m.fixtureNumber,
      homeTeam: localized.homeTeam,
      awayTeam: localized.awayTeam,
      kickoffTime: m.kickoffTime.toISOString(),
      stage: m.stage,
      odds: odds
        ? {
            home: odds.homeOdds,
            draw: odds.drawOdds,
            away: odds.awayOdds,
            source: odds.source,
            fetchedAt: odds.fetchedAt.toISOString(),
          }
        : null,
      userBet: (() => {
        const bet = userBetByMatch.get(m.id);
        if (!bet) return null;
        return {
          id: bet.id,
          selection: bet.selection,
          stake: bet.stake,
          odds: bet.odds,
          status: bet.status,
        };
      })(),
    };
  });

  const leaderboard = await prisma.virtualWallet.findMany({
    orderBy: { balance: "desc" },
    take: 10,
    include: {
      user: { select: { nickname: true } },
    },
  });

  const recentEarnings = await prisma.virtualTokenLedger.findMany({
    where: {
      userId,
      reason: { not: "admin_adjustment" },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { amount: true, reason: true, createdAt: true },
  });

  return {
    disclaimer:
      "Gra towarzyska — punkty aktywności wyłącznie na zabawę, bez wpływu na ranking ligowy.",
    wallet: { balance: wallet.balance },
    earningRules: ACTIVITY_EARNING_RULES,
    recentEarnings: recentEarnings.map((e) => ({
      amount: e.amount,
      reason: e.reason,
      createdAt: e.createdAt.toISOString(),
    })),
    bettableMatches,
    betHistory: userBets.map((b) => {
      const lm = localizeMatch(b.match);
      return {
        id: b.id,
        matchId: b.matchId,
        homeTeam: lm.homeTeam,
        awayTeam: lm.awayTeam,
        kickoffTime: b.match.kickoffTime.toISOString(),
        selection: b.selection,
        stake: b.stake,
        odds: b.odds,
        status: b.status,
        payout: b.payout,
        createdAt: b.createdAt.toISOString(),
        settledAt: b.settledAt?.toISOString() ?? null,
        homeScore: b.match.homeScore,
        awayScore: b.match.awayScore,
      };
    }),
    funLeaderboard: leaderboard.map((w, i) => ({
      rank: i + 1,
      nickname: w.user.nickname,
      balance: w.balance,
    })),
    limits: {
      minStake: SIMULATOR_MIN_STAKE,
      maxStake: SIMULATOR_MAX_STAKE,
    },
  };
}
