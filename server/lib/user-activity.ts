import { prisma } from "./prisma.js";
import { rewardOnlineSession } from "./virtual-token-rewards.js";

const TOUCH_INTERVAL_MS = 60_000;
const lastTouchedAt = new Map<string, number>();

/** Nie przerywa logowania ani typów — tylko best-effort, max raz na minutę. */
export async function touchUserActivity(userId: string): Promise<void> {
  const now = Date.now();
  const prev = lastTouchedAt.get(userId) ?? 0;
  if (now - prev < TOUCH_INTERVAL_MS) return;

  lastTouchedAt.set(userId, now);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
    void rewardOnlineSession(userId, new Date(now));
  } catch (err) {
    lastTouchedAt.delete(userId);
    console.error("touchUserActivity:", err);
  }
}
