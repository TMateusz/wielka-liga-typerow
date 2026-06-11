import { syncWorldCup2026Live } from "./worldcup2026-sync.js";
import { isApiFootballConfigured } from "./api-football.js";
import { syncMatchResults } from "./sync-service.js";

const DEFAULT_INTERVAL_MS = 60_000;
const API_FOOTBALL_INTERVAL_MS = 30 * 60 * 1000;

export function startLiveSyncScheduler() {
  if (process.env.LIVE_SYNC_ENABLED === "false") {
    console.log("Live sync wyłączony (LIVE_SYNC_ENABLED=false)");
    return;
  }

  const intervalMs = Number(process.env.LIVE_SYNC_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  const runWorldCup = async () => {
    try {
      const result = await syncWorldCup2026Live();
      if (result.finalized > 0 || result.live > 0 || result.errors.length > 0) {
        console.log(
          `[Live sync] LIVE:${result.live} zakt:${result.updated} rozlicz:${result.finalized}` +
            (result.errors.length ? ` uwagi:${result.errors.length}` : ""),
        );
      }
    } catch (e) {
      console.error(
        "[Live sync] Błąd:",
        e instanceof Error ? e.message : e,
      );
    }
  };

  setTimeout(() => void runWorldCup(), 8_000);
  setInterval(() => void runWorldCup(), intervalMs);

  console.log(
    `Live sync worldcup26.ir co ${intervalMs / 1000}s (poprawki ręczne w adminie nadal działają)`,
  );

  if (isApiFootballConfigured() && process.env.API_FOOTBALL_AUTO_SYNC !== "false") {
    const runApiFootball = async () => {
      try {
        const result = await syncMatchResults();
        console.log(
          `[API-Football] Sync OK — zakt. ${result.updated}, zakończ. ${result.finalized}, live ${result.live}`,
        );
      } catch (e) {
        console.error(
          "[API-Football] Sync błąd:",
          e instanceof Error ? e.message : e,
        );
      }
    };

    setTimeout(() => void runApiFootball(), 20_000);
    setInterval(() => void runApiFootball(), API_FOOTBALL_INTERVAL_MS);
    console.log(`API-Football backup sync co ${API_FOOTBALL_INTERVAL_MS / 60_000} min`);
  }
}
