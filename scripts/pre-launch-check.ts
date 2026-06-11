/**
 * Ostateczny checklist przed startem MŚ.
 * Uruchom: npx tsx scripts/pre-launch-check.ts [BASE_URL]
 * Domyślnie: https://liga-typerow.itur.app
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWorldCup2026Games } from "../server/lib/worldcup2026-api.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.argv[2] ?? "https://liga-typerow.itur.app").replace(/\/$/, "");

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`  ${icon} ${name}: ${detail}`);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function checkProduction() {
  console.log("\n── Produkcja / API ──\n");

  try {
    const health = await fetchJson<{ status: string }>(`${baseUrl}/api/health`);
    record("Health", health.status === "ok", health.status);
  } catch (e) {
    record("Health", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const lb = await fetchJson<{
      users: { id: string; totalPoints: number }[];
      playerCount: number;
      tournamentProgress?: { finished: number; total: number };
    }>(`${baseUrl}/api/leaderboard`);
    record(
      "Ranking",
      lb.users.length > 0,
      `${lb.playerCount ?? lb.users.length} graczy, top: ${lb.users[0]?.totalPoints ?? 0} pkt`,
    );
    if (lb.tournamentProgress) {
      const tp = lb.tournamentProgress as { total?: number; finished?: number; totalMatches?: number; settledMatches?: number };
      const total = tp.totalMatches ?? tp.total ?? 0;
      const settled = tp.settledMatches ?? tp.finished ?? 0;
      record("Postęp turnieju", total === 104, `${settled}/${total} rozstrzygniętych`);
    }
  } catch (e) {
    record("Ranking", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const tips = await fetchJson<{
      matches: {
        id: string;
        homeTeam: string;
        awayTeam: string;
        status: string;
        kickoffTime: string;
        fixtureNumber?: number;
      }[];
      predictions: unknown[];
    }>(`${baseUrl}/api/leaderboard/tips`);

    const matchCount = tips.matches.length;
    record("Mecze w bazie", matchCount === 104, `${matchCount} (oczekiwano 104)`);

    const m1 = tips.matches.find(
      (m) =>
        m.homeTeam.toLowerCase().includes("meksyk") ||
        m.homeTeam.toLowerCase().includes("mexico"),
    );
    if (m1) {
      const kickoff = new Date(m1.kickoffTime);
      record(
        "M1 (Meksyk)",
        m1.status === "PENDING",
        `${m1.homeTeam} vs ${m1.awayTeam} · ${kickoff.toISOString()} · ${m1.status}`,
      );
    } else {
      record("M1 (Meksyk)", false, "nie znaleziono meczu otwarcia");
    }

    record("Typy w bazie", tips.predictions.length > 0, `${tips.predictions.length} rekordów`);
  } catch (e) {
    record("Tips / mecze", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const cal = await fetchJson<{ matches: unknown[] }>(`${baseUrl}/api/calendar`);
    record("Kalendarz /api/calendar", cal.matches.length === 104, `${cal.matches.length} meczów`);
  } catch (e) {
    record("Kalendarz ICS", false, e instanceof Error ? e.message : String(e));
  }
}

async function checkWorldCupApi() {
  console.log("\n── worldcup26.ir (live sync) ──\n");

  try {
    const games = await fetchWorldCup2026Games();
    record("API dostępne", games.length === 104, `${games.length} meczów`);

    const m1 = games.find((g) => g.id === "1");
    if (m1) {
      record(
        "M1 w API",
        m1.home_team_name_en === "Mexico",
        `${m1.home_team_name_en} vs ${m1.away_team_name_en} · ${m1.finished} · ${m1.time_elapsed}`,
      );
    } else {
      record("M1 w API", false, "brak id=1");
    }

    const notStarted = games.filter((g) => (g.time_elapsed ?? "").toLowerCase() === "notstarted").length;
    record("Mecze notstarted", notStarted > 0, `${notStarted} jeszcze nie ruszyło`);
  } catch (e) {
    record("worldcup26.ir", false, e instanceof Error ? e.message : String(e));
  }
}

function runScoringTests() {
  console.log("\n── Punktacja (lokalnie) ──\n");

  const result = spawnSync("npm", ["run", "test:points"], {
    cwd: root,
    stdio: "pipe",
    shell: process.platform === "win32",
    encoding: "utf-8",
  });

  const output = (result.stdout ?? "") + (result.stderr ?? "");
  const passed = result.status === 0 && output.includes("Wszystkie testy punktacji przeszły");
  record(
    "npm run test:points",
    passed,
    passed ? "38 testów + 2 symulacje DB OK" : `exit ${result.status}`,
  );
  if (!passed && output) {
    const tail = output.split("\n").slice(-8).join("\n");
    console.log(tail);
  }
}

function runBuild() {
  console.log("\n── Build ──\n");

  const result = spawnSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "pipe",
    shell: process.platform === "win32",
    encoding: "utf-8",
  });

  record("npm run build", result.status === 0, result.status === 0 ? "Vite + tsc OK" : `exit ${result.status}`);
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  PRE-LAUNCH CHECK — Wielka Liga Typerów  ║");
  console.log(`║  ${baseUrl.padEnd(40)} ║`);
  console.log("╚══════════════════════════════════════════╝");

  runScoringTests();
  runBuild();
  await checkWorldCupApi();
  await checkProduction();

  const failed = checks.filter((c) => !c.ok);
  console.log("\n══════════════════════════════════════════");
  if (failed.length === 0) {
    console.log(`✓ Wszystko OK (${checks.length} sprawdzeń)`);
    console.log("\nPrzed M1 na VPS upewnij się:");
    console.log("  • LIVE_SYNC_ENABLED=true");
    console.log("  • docker compose ps — kontener działa");
    console.log("  • NIE uruchamiaj db:seed / db:reset");
  } else {
    console.log(`✗ ${failed.length} problem(ów):`);
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
  console.log("══════════════════════════════════════════\n");
}

void main();
