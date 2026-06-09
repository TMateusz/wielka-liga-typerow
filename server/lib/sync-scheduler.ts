import { isApiFootballConfigured } from "./api-football.js";
import { syncMatchResults } from "./sync-service.js";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 min — oszczędza limit API (plan darmowy: 100 req/dzień)

export function startSyncScheduler() {
  if (process.env.API_FOOTBALL_AUTO_SYNC === "false") {
    console.log("Auto-sync API-Football wyłączony (API_FOOTBALL_AUTO_SYNC=false)");
    return;
  }

  if (!isApiFootballConfigured()) {
    console.log("Auto-sync API-Football: brak klucza API_FOOTBALL_KEY — pominięto");
    return;
  }

  const intervalMs = Number(process.env.API_FOOTBALL_SYNC_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  const run = async () => {
    try {
      const result = await syncMatchResults();
      console.log(
        `[API-Football] Sync OK — zakt. ${result.updated}, zakończ. ${result.finalized}, live ${result.live}`
      );
    } catch (e) {
      console.error("[API-Football] Sync błąd:", e instanceof Error ? e.message : e);
    }
  };

  // Pierwsza synchronizacja 10 s po starcie serwera
  setTimeout(run, 10_000);
  setInterval(run, intervalMs);

  console.log(`Auto-sync API-Football co ${intervalMs / 60_000} min`);
}
