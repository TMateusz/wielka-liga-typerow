const API_BASE = "https://v3.football.api-sports.io";

export type ApiFixtureStatus = {
  short: string;
  long: string;
};

export type ApiFixtureItem = {
  fixture: {
    id: number;
    date: string;
    status: ApiFixtureStatus;
    venue?: { name?: string; city?: string };
  };
  league: {
    id: number;
    name: string;
    round?: string;
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    fulltime: { home: number | null; away: number | null };
  };
};

type ApiResponse<T> = {
  results: number;
  paging?: { current: number; total: number };
  response: T;
  errors?: Record<string, string> | string[];
};

export function isApiFootballConfigured(): boolean {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

function getApiKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error("Brak klucza API_FOOTBALL_KEY w pliku .env");
  }
  return key;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-apisports-key": getApiKey(),
    },
  });

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as ApiResponse<T>;

  if (data.errors && Object.keys(data.errors).length > 0) {
    const msg = Array.isArray(data.errors)
      ? data.errors.join(", ")
      : Object.values(data.errors).join(", ");
    throw new Error(`API-Football: ${msg}`);
  }

  return data.response;
}

/** Pobiera wszystkie mecze MŚ 2026 (liga=1, sezon=2026, ~104 mecze). */
export async function fetchWorldCupFixtures(): Promise<ApiFixtureItem[]> {
  const leagueId = process.env.API_FOOTBALL_LEAGUE_ID ?? "1";
  const season = process.env.API_FOOTBALL_SEASON ?? "2026";

  const all: ApiFixtureItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const path = `/fixtures?league=${leagueId}&season=${season}&page=${page}`;
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-apisports-key": getApiKey() },
    });

    if (!res.ok) {
      throw new Error(`API-Football HTTP ${res.status}`);
    }

    const data = (await res.json()) as ApiResponse<ApiFixtureItem[]>;
    if (data.errors && Object.keys(data.errors).length > 0) {
      const msg = Array.isArray(data.errors)
        ? data.errors.join(", ")
        : Object.values(data.errors).join(", ");
      throw new Error(`API-Football: ${msg}`);
    }

    all.push(...data.response);
    totalPages = data.paging?.total ?? 1;
    page++;
  }

  return all;
}

/** Pobiera aktualnie trwające mecze (filtrowane do MŚ). */
export async function fetchLiveFixtures(): Promise<ApiFixtureItem[]> {
  const leagueId = Number(process.env.API_FOOTBALL_LEAGUE_ID ?? "1");
  const live = await apiFetch<ApiFixtureItem[]>("/fixtures?live=all");
  return live.filter((f) => f.league.id === leagueId);
}

/** Pobiera konkretne mecze po ID (max 20 naraz). */
export async function fetchFixturesByIds(ids: number[]): Promise<ApiFixtureItem[]> {
  if (ids.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 20) {
    chunks.push(ids.slice(i, i + 20));
  }

  const results: ApiFixtureItem[] = [];
  for (const chunk of chunks) {
    const batch = await apiFetch<ApiFixtureItem[]>(`/fixtures?ids=${chunk.join("-")}`);
    results.push(...batch);
  }

  return results;
}
