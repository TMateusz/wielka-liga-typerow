/**
 * Siła reprezentacji na skali Elo (~1740–2140), kalibrowana wg rankingu FIFA / klasy drużyn.
 * Kursy 1X2 liczone z różnicy Elo + przewaga gospodarzy MŚ 2026 (USA, Meksyk, Kanada).
 */
export const TEAM_STRENGTH: Record<string, number> = {
  Argentina: 2140,
  France: 2120,
  Spain: 2110,
  England: 2100,
  Brazil: 2095,
  Portugal: 2085,
  Netherlands: 2065,
  Belgium: 2055,
  Germany: 2050,
  Croatia: 2040,
  Colombia: 2030,
  Uruguay: 2025,
  Morocco: 2010,
  USA: 2005,
  Mexico: 1995,
  Japan: 1985,
  Switzerland: 1980,
  Senegal: 1975,
  Austria: 1965,
  Norway: 1960,
  Canada: 1955,
  "South Korea": 1950,
  Australia: 1945,
  Czechia: 1940,
  Türkiye: 1935,
  Ecuador: 1925,
  Scotland: 1915,
  Sweden: 1910,
  Egypt: 1905,
  Iran: 1900,
  Algeria: 1895,
  "Ivory Coast": 1890,
  Tunisia: 1885,
  Paraguay: 1875,
  "Bosnia and Herzegovina": 1870,
  Qatar: 1860,
  "Saudi Arabia": 1855,
  Ghana: 1850,
  Panama: 1840,
  "Cape Verde": 1835,
  Jordan: 1820,
  Uzbekistan: 1815,
  Iraq: 1810,
  "South Africa": 1805,
  "New Zealand": 1795,
  "Congo DR": 1790,
  Haiti: 1760,
  Curaçao: 1740,
};

/** Gospodarze MŚ 2026 — lekka premia na własnym kontynencie. */
const HOST_TEAMS = new Set(["Mexico", "USA", "Canada"]);
const HOME_ADVANTAGE = 55;
const HOST_BONUS = 35;

export function teamStrength(name: string): number | null {
  return TEAM_STRENGTH[name] ?? null;
}

export function effectiveHomeStrength(home: string): number {
  const base = TEAM_STRENGTH[home];
  if (base == null) return 1900;
  return base + HOME_ADVANTAGE + (HOST_TEAMS.has(home) ? HOST_BONUS : 0);
}

export function effectiveAwayStrength(away: string): number {
  const base = TEAM_STRENGTH[away];
  if (base == null) return 1900;
  return base;
}

export type StrengthOdds = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
};

/** Prawdopodobieństwa 1X2 z różnicy Elo + marża buka ~8%. */
export function oddsFromTeamStrength(home: string, away: string): StrengthOdds {
  const homeElo = effectiveHomeStrength(home);
  const awayElo = effectiveAwayStrength(away);
  const diff = homeElo - awayElo;

  const homeWinShare = 1 / (1 + 10 ** (-diff / 400));
  const drawShare = Math.max(0.18, 0.28 - Math.abs(diff) / 3500);
  const remaining = 1 - drawShare;
  const pHome = remaining * homeWinShare;
  const pDraw = drawShare;
  const pAway = remaining * (1 - homeWinShare);

  const margin = 1.08;
  return {
    homeOdds: roundOdds(margin / pHome),
    drawOdds: roundOdds(margin / pDraw),
    awayOdds: roundOdds(margin / pAway),
  };
}

function roundOdds(value: number): number {
  return Math.round(Math.max(1.05, Math.min(50, value)) * 100) / 100;
}

/** Knockout / placeholder — wyrównane spotkanie. */
export function balancedKnockoutOdds(): StrengthOdds {
  return { homeOdds: 2.45, drawOdds: 3.15, awayOdds: 2.45 };
}
