/** Best-effort nagrody aktywności — błędy nie mogą psuć głównej ligi. */
export function scheduleActivityReward(task: Promise<unknown>): void {
  void task.catch(() => {});
}

export async function runAfterMatchFinished(matchId: string): Promise<void> {
  try {
    const { settleVirtualBetsForMatch } = await import("./virtual-betting-service.js");
    const { rewardAllFinishedPredictionsForMatch } = await import("./virtual-token-rewards.js");
    await settleVirtualBetsForMatch(matchId);
    await rewardAllFinishedPredictionsForMatch(matchId);
  } catch {
    // Moduł aktywności niedostępny — rozliczenie ligi już zakończone.
  }

  // Push notifications — best-effort, errors silenced
  try {
    const { sendPointsNotification, sendMatchFinishedNotification } = await import("./push-scheduler.js");
    // Get final score for the finished notification
    const { prisma } = await import("./prisma.js");
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { homeScore: true, awayScore: true },
    });
    if (match?.homeScore != null && match?.awayScore != null) {
      await sendMatchFinishedNotification(matchId, match.homeScore, match.awayScore);
    }
    await sendPointsNotification(matchId);
  } catch {
    // Push not configured or failed — not critical.
  }
}
