import { formatPolishDateLong, toPolishDateKey } from "./calendar-dates.js";

export type KolejkaMatch = {
  kickoffTime: string;
  status: string;
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
