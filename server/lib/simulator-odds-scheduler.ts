import { syncSimulatorOdds } from "./simulator-odds-sync.js";

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startSimulatorOddsScheduler() {
  if (process.env.SIMULATOR_ODDS_SYNC_ENABLED === "false") {
    console.log("Sync kursów symulatora wyłączony (SIMULATOR_ODDS_SYNC_ENABLED=false)");
    return;
  }

  const intervalMs = Number(process.env.SIMULATOR_ODDS_SYNC_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  const run = async () => {
    try {
      const result = await syncSimulatorOdds();
      console.log(`[Symulator kursy] zakt. ${result.updated} meczów (model Elo)`);
    } catch (error) {
      console.error(
        "[Symulator kursy] Błąd:",
        error instanceof Error ? error.message : error,
      );
    }
  };

  setTimeout(() => void run(), 15_000);
  setInterval(() => void run(), intervalMs);

  console.log(`Sync kursów symulatora co ${intervalMs / 3_600_000}h (model siły drużyn)`);
}
