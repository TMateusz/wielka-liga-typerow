import { Prisma } from "@prisma/client";
import { SIMULATOR_INITIAL_BALANCE, ACTIVITY_REWARDS } from "../../shared/simulator.js";
import { prisma } from "./prisma.js";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Idempotentne dopisanie punktów aktywności (ledger zapobiega podwójnym nagrodom). */
export async function tryCreditTokens(
  userId: string,
  amount: number,
  reason: string,
  referenceKey: string,
): Promise<{ credited: number; alreadyGranted: boolean }> {
  if (amount <= 0) {
    return { credited: 0, alreadyGranted: false };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.virtualTokenLedger.create({
        data: { userId, amount, reason, referenceKey },
      });

      await tx.virtualWallet.upsert({
        where: { userId },
        create: { userId, balance: SIMULATOR_INITIAL_BALANCE + amount },
        update: { balance: { increment: amount } },
      });
    });
    return { credited: amount, alreadyGranted: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { credited: 0, alreadyGranted: true };
    }
    throw error;
  }
}

export async function rewardBetPlaced(userId: string, matchId: string) {
  return tryCreditTokens(
    userId,
    ACTIVITY_REWARDS.BET_PLACED,
    "bet_placed",
    `typ:${matchId}`,
  );
}

export async function rewardFinishedPrediction(
  userId: string,
  matchId: string,
  pointsEarned: number,
) {
  const points = ACTIVITY_REWARDS.pointsToActivity(pointsEarned);
  if (points <= 0) return { credited: 0, alreadyGranted: false };

  return tryCreditTokens(
    userId,
    points,
    "prediction_result",
    `typ-wynik:${matchId}`,
  );
}

function rewardIntervalSlot(now = new Date()): number {
  return (
    Math.floor(now.getTime() / ACTIVITY_REWARDS.REWARD_INTERVAL_MS) *
    ACTIVITY_REWARDS.REWARD_INTERVAL_MS
  );
}

export async function rewardChatMessage(userId: string, now = new Date()) {
  return tryCreditTokens(
    userId,
    ACTIVITY_REWARDS.CHAT_MESSAGE,
    "chat_message",
    `chat:${rewardIntervalSlot(now)}`,
  );
}
export async function rewardChatHeart(userId: string, messageId: string) {
  return tryCreditTokens(
    userId,
    ACTIVITY_REWARDS.CHAT_HEART,
    "chat_heart",
    `heart:${messageId}`,
  );
}

export async function rewardOnlineSession(userId: string, now = new Date()) {
  return tryCreditTokens(
    userId,
    ACTIVITY_REWARDS.ONLINE_SESSION,
    "online_session",
    `online:${rewardIntervalSlot(now)}`,
  );
}
export async function rewardAllFinishedPredictionsForMatch(matchId: string) {
  const predictions = await prisma.prediction.findMany({
    where: { matchId, pointsEarned: { not: null } },
    select: { userId: true, pointsEarned: true },
  });

  for (const p of predictions) {
    await rewardFinishedPrediction(p.userId, matchId, p.pointsEarned ?? 0);
  }
}

/** Cicha korekta salda przez administratora — bez wpisu w historii nagród. */
export async function adminSetVirtualBalance(
  userId: string,
  newBalance: number,
): Promise<{ balance: number; previousBalance: number }> {
  if (!Number.isInteger(newBalance) || newBalance < 0) {
    throw new Error("Saldo musi być liczbą całkowitą ≥ 0");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.virtualWallet.findUnique({ where: { userId } });
    const previousBalance = existing?.balance ?? 0;

    if (newBalance === previousBalance && existing) {
      return { balance: newBalance, previousBalance };
    }

    await tx.virtualWallet.upsert({
      where: { userId },
      create: { userId, balance: newBalance },
      update: { balance: newBalance },
    });

    return { balance: newBalance, previousBalance };
  });
}
