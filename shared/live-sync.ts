/** Odświeżanie UI podczas trwających meczów (ms). */
export const LIVE_UI_POLL_MS = 60_000;

export type MatchActivityInput = {
  status: string;
  kickoffTime: string;
};

export function hasLiveMatches(matches: MatchActivityInput[]): boolean {
  return matches.some((m) => m.status === "LIVE");
}

/** Mecz wkrótce startuje, trwa lub świeżo się skończył — warto częściej odpytywać API. */
export function hasMatchesNeedingLivePoll(
  matches: MatchActivityInput[],
  now: Date = new Date(),
): boolean {
  return matches.some((m) => {
    if (m.status === "LIVE") return true;
    if (m.status === "FINISHED") return false;

    const msFromKickoff = now.getTime() - new Date(m.kickoffTime).getTime();
    const fiveMinBefore = -5 * 60 * 1000;
    const threeHoursAfter = 3 * 60 * 60 * 1000;
    return msFromKickoff >= fiveMinBefore && msFromKickoff <= threeHoursAfter;
  });
}
