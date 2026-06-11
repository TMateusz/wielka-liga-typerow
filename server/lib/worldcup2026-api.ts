const DEFAULT_BASE = "https://worldcup26.ir";

export type Wc2026Game = {
  id: string;
  home_score: string;
  away_score: string;
  finished: string;
  time_elapsed: string;
  type: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
};

type GamesResponse = {
  games: Wc2026Game[];
};

export function getWorldCup2026BaseUrl(): string {
  return (process.env.WORLDCUP2026_API_URL ?? DEFAULT_BASE).replace(/\/$/, "");
}

export async function fetchWorldCup2026Games(): Promise<Wc2026Game[]> {
  const base = getWorldCup2026BaseUrl();
  const res = await fetch(`${base}/get/games`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`WorldCup2026 API HTTP ${res.status}`);
  }

  const data = (await res.json()) as GamesResponse;
  if (!Array.isArray(data.games)) {
    throw new Error("WorldCup2026 API: nieprawidłowa odpowiedź");
  }

  return data.games;
}
