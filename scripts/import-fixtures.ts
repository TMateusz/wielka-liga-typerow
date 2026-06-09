import { importWorldCupFixtures } from "../server/lib/sync-service.js";

async function main() {
  console.log("Importowanie terminarza MŚ 2026 z API-Football…");
  const result = await importWorldCupFixtures();
  console.log("✅ Gotowe:", result);
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("❌ Błąd:", e);
  process.exit(1);
});
