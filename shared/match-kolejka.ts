import { formatPolishDateLong, toPolishDateKey } from "./calendar-dates.js";

export type KolejkaMatch = {
  kickoffTime: string;
  status: string;
};

export type DeltaReferenceMatch = {
  kickoffTime: string;
  status: string;
  fixtureNumber: number | null;
  homeTeam: string;
  awayTeam: string;
};

export type DeltaReference = {
  /** Stan rankingu liczony z meczów zakończonych przed tym czasem. */
  beforeKickoff: Date;
  matchKey: string;
  matchLabel: string;
  isLive: boolean;
};

/** Kolejka = dzień meczowy w czasie polskim (wszystkie mecze tego dnia). */
export function getKolejkaKey(kickoffTime: Date | string): string {
  return toPolishDateKey(kickoffTime);
}

export type ActiveKolejka = {
  key: string;
  startsAt: Date;
  label: string;
};

/**
 * Aktywna kolejka: pierwszy dzień z meczem LIVE lub nierozegranym.
 * Gdy wszystko rozegrane — ostatnia kolejka turnieju.
 */
export function resolveActiveKolejka(matches: KolejkaMatch[]): ActiveKolejka | null {
  if (matches.length === 0) return null;

  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
  );

  const keys = [...new Set(sorted.map((m) => getKolejkaKey(m.kickoffTime)))].sort();

  for (const key of keys) {
    const inKolejka = sorted.filter((m) => getKolejkaKey(m.kickoffTime) === key);
    if (inKolejka.some((m) => m.status !== "FINISHED")) {
      return kolejkaFromMatches(key, inKolejka);
    }
  }

  const lastKey = getKolejkaKey(sorted[sorted.length - 1].kickoffTime);
  const inKolejka = sorted.filter((m) => getKolejkaKey(m.kickoffTime) === lastKey);
  return kolejkaFromMatches(lastKey, inKolejka);
}

function kolejkaFromMatches(key: string, matches: KolejkaMatch[]): ActiveKolejka {
  const startsAt = new Date(
    Math.min(...matches.map((m) => new Date(m.kickoffTime).getTime())),
  );
  return { key, startsAt, label: formatPolishDateLong(key) };
}

function formatDeltaMatchLabel(m: DeltaReferenceMatch): string {
  const prefix = m.fixtureNumber != null ? `M${m.fixtureNumber}` : "Mecz";
  return `${prefix} · ${m.homeTeam} – ${m.awayTeam}`;
}

/**
 * Mecz odniesienia dla Δ: LIVE (najwcześniejszy) albo ostatni rozegrany.
 * Baseline = ranking tuż przed gwizdkiem tego meczu.
 */
export function resolveDeltaReferenceMatch(
  matches: DeltaReferenceMatch[],
): DeltaReference | null {
  if (matches.length === 0) return null;

  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
  );

  const live = sorted.filter((m) => m.status === "LIVE");
  const ref = live.length > 0 ? live[0] : sorted.filter((m) => m.status === "FINISHED").at(-1);

  if (!ref) return null;

  const fixtureKey = ref.fixtureNumber != null ? String(ref.fixtureNumber) : ref.kickoffTime;

  return {
    beforeKickoff: new Date(ref.kickoffTime),
    matchKey: fixtureKey,
    matchLabel: formatDeltaMatchLabel(ref),
    isLive: ref.status === "LIVE",
  };
}
