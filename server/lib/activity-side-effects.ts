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

  // Push notification — best-effort, errors silenced
  try {
    const { sendPointsNotification } = await import("./push-scheduler.js");
    await sendPointsNotification(matchId);
  } catch {
    // Push not configured or failed — not critical.
  }
}
