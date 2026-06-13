import { syncSimulatorOdds } from "../server/lib/simulator-odds-sync.js";

async function main() {
  console.log("Synchronizacja kursów symulatora…");
  const result = await syncSimulatorOdds();
  console.log(`✅ Zaktualizowano ${result.updated} meczów`);
  if (result.errors.length > 0) {
    console.warn("Uwagi:", result.errors.slice(0, 5).join("; "));
  }
  process.exit(result.errors.length > 0 && result.updated === 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ Błąd:", error);
  process.exit(1);
});
