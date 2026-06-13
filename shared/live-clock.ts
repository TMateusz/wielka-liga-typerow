/** Czy worldcup26 zwrócił sensowną minutę (a nie „live” / pusty string). */
export function needsExternalLiveMinute(raw: string | null | undefined): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (lower === "notstarted" || lower === "finished") return false;

  const generic = new Set([
    "live",
    "inprogress",
    "in progress",
    "playing",
    "ongoing",
    "started",
  ]);
  if (generic.has(lower)) return true;

  if (parseLiveMinuteValue(trimmed) != null) return false;
  if (isHalftimeClock(trimmed)) return false;

  return true;
}

/** Zapis z API (worldcup26 `time_elapsed`) — tylko gdy mecz trwa. */
export function normalizeLiveClock(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === "notstarted" || lower === "finished") return null;

  const generic = new Set(["live", "inprogress", "in progress", "playing", "ongoing", "started"]);
  if (generic.has(lower)) return null;

  const parsed = parseLiveMinuteValue(trimmed);
  if (parsed != null) return parsed;
  if (isHalftimeClock(trimmed)) return "HT";

  return trimmed;
}

function isHalftimeClock(clock: string): boolean {
  const lower = clock.trim().toLowerCase();
  return lower === "half" || lower === "ht" || lower === "halftime" || lower === "half_time" || lower === "break";
}

/** Parsuje minutę z różnych formatów (67, 67', 90+3, 90'+7'). */
export function parseLiveMinuteValue(clock: string): string | null {
  const trimmed = clock.trim();
  const match = trimmed.match(/^(\d{1,3})(?:['′]?\s*\+\s*(\d{1,2})|\+(\d{1,2}))?['′]?$/);
  if (!match) return null;

  const base = match[1];
  const extra = match[2] ?? match[3];
  return extra ? `${base}+${extra}` : base;
}

/** Normalizuje minutę z zewnętrznego API (np. ESPN displayClock). */
export function normalizeExternalLiveClock(displayClock: string | null | undefined): string | null {
  const trimmed = (displayClock ?? "").trim();
  if (!trimmed) return null;

  if (isHalftimeClock(trimmed)) return "HT";

  const parsed = parseLiveMinuteValue(trimmed.replace(/^(\d+)['′]\+(\d+)['′]?$/, "$1+$2"));
  return parsed;
}

/** Etykieta minuty do UI, np. „67′”, „45+2′”, „Przerwa”. */
export function formatLiveClockDisplay(clock: string | null | undefined): string | null {
  if (!clock) return null;

  const lower = clock.trim().toLowerCase();
  if (lower === "notstarted" || lower === "finished") return null;
  if (needsExternalLiveMinute(clock)) return null;
  if (isHalftimeClock(clock)) return "Przerwa";

  const parsed = parseLiveMinuteValue(clock);
  if (parsed) return `${parsed}′`;

  return clock.trim();
}
