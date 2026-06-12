/** Zapis z API (worldcup26 `time_elapsed`) — tylko gdy mecz trwa. */
export function normalizeLiveClock(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === "notstarted" || lower === "finished") return null;

  return trimmed;
}

/** Etykieta minuty do UI, np. „67′”, „45+2′”, „Przerwa”. */
export function formatLiveClockDisplay(clock: string | null | undefined): string | null {
  if (!clock) return null;

  const lower = clock.trim().toLowerCase();
  if (lower === "notstarted" || lower === "finished") return null;

  if (
    lower === "half" ||
    lower === "ht" ||
    lower === "halftime" ||
    lower === "half_time" ||
    lower === "break"
  ) {
    return "Przerwa";
  }

  if (/^\d+(\+\d+)?$/.test(lower)) {
    return `${clock.trim()}′`;
  }

  return clock.trim();
}
