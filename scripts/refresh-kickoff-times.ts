/**
 * Bezpieczna aktualizacja godzin startu z lokalnego terminarza.
 * Aktualizuje tylko mecze PENDING (kickoffTime, drużyny, faza, stadion).
 * Nie rusza: typów, punktów, wyników, kont graczy.
 */
import { MatchStatus } from "@prisma/client";
import { WC2026_FIXTURES, etToUtc } from "../server/data/worldcup-2026-fixtures.js";
import { importStaticFixtures } from "../server/lib/sync-service.js";
import { prisma } from "../server/lib/prisma.js";

async function main() {
  const before = await prisma.match.findMany({
    where: { fixtureNumber: { in: [6, 20, 36] } },
    select: { fixtureNumber: true, kickoffTime: true, status: true },
  });

  console.log("Przed aktualizacją (M6, M20, M36):");
  for (const row of before) {
    console.log(`  M${row.fixtureNumber}: ${row.kickoffTime.toISOString()} (${row.status})`);
  }

  const result = await importStaticFixtures();

  const after = await prisma.match.findMany({
    where: { fixtureNumber: { in: [6, 20, 36] } },
    select: { fixtureNumber: true, kickoffTime: true, status: true },
  });

  console.log("\nPo aktualizacji:");
  for (const row of after) {
    const expected = WC2026_FIXTURES.find((f) => f.n === row.fixtureNumber);
    const expectedUtc = expected ? etToUtc(expected.date, expected.timeEt).toISOString() : "?";
    console.log(`  M${row.fixtureNumber}: ${row.kickoffTime.toISOString()} (oczek. ${expectedUtc})`);
  }

  const predictions = await prisma.prediction.count();
  const finished = await prisma.match.count({ where: { status: MatchStatus.FINISHED } });

  console.log("\nPodsumowanie importu:", result);
  console.log(`Typy w bazie: ${predictions} (bez zmian)`);
  console.log(`Mecze FINISHED: ${finished} (nieaktualizowane)`);
}

main()
  .catch((e) => {
    console.error("Błąd:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
