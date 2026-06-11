/**
 * Symulacja live scoringu — tworzy tymczasowe dane, testuje przepływ, sprząta po sobie.
 * Uruchom: npx tsx scripts/simulate-live-scoring.ts
 * (wymaga DATABASE_URL, np. file:./data/sim-live-test.db)
 */
import { MatchStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { setMatchResult, updateLiveMatchScore } from "../server/lib/match-service.js";
import { SCORING } from "../shared/scoring.js";

const prisma = new PrismaClient();

const SIM_FIXTURE = 99_999;
const SIM_PREFIX = `__sim_live_${Date.now()}`;

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string): never {
  throw new Error(msg);
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    fail(`${label}: oczekiwano ${expected}, jest ${actual}`);
  }
  ok(label);
}

async function readState(userId: string, matchId: string) {
  const [user, prediction, match] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.prediction.findUniqueOrThrow({ where: { userId_matchId: { userId, matchId } } }),
    prisma.match.findUniqueOrThrow({ where: { id: matchId } }),
  ]);
  return {
    totalPoints: user.totalPoints,
    pointsEarned: prediction.pointsEarned,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };
}

async function cleanup() {
  const matches = await prisma.match.findMany({
    where: { fixtureNumber: SIM_FIXTURE },
    select: { id: true },
  });
  const matchIds = matches.map((m) => m.id);

  if (matchIds.length > 0) {
    await prisma.prediction.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.matchResultHistory.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  }

  await prisma.user.deleteMany({
    where: { nickname: { startsWith: SIM_PREFIX } },
  });
}

async function main() {
  console.log("\n=== Symulacja live scoringu ===\n");

  await cleanup();

  const match = await prisma.match.create({
    data: {
      fixtureNumber: SIM_FIXTURE,
      homeTeam: "Symulacja A",
      awayTeam: "Symulacja B",
      kickoffTime: new Date(Date.now() - 60 * 60 * 1000),
      stage: "Faza grupowa",
      status: MatchStatus.PENDING,
    },
  });

  const [userExact, userOutcome, admin] = await Promise.all([
    prisma.user.create({
      data: {
        firstName: "Sim",
        lastName: "Exact",
        nickname: `${SIM_PREFIX}_exact`,
        password: "sim",
        totalPoints: 10,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "Sim",
        lastName: "Outcome",
        nickname: `${SIM_PREFIX}_outcome`,
        password: "sim",
        totalPoints: 5,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "Sim",
        lastName: "Admin",
        nickname: `${SIM_PREFIX}_admin`,
        password: "sim",
        role: "ADMIN",
      },
    }),
  ]);

  await prisma.prediction.createMany({
    data: [
      {
        userId: userExact.id,
        matchId: match.id,
        predictedHomeScore: 2,
        predictedAwayScore: 1,
      },
      {
        userId: userOutcome.id,
        matchId: match.id,
        predictedHomeScore: 1,
        predictedAwayScore: 0,
      },
    ],
  });

  console.log("1) LIVE 1:0 — pierwsze naliczenie punktów");
  await updateLiveMatchScore(match.id, 1, 0);

  let exact = await readState(userExact.id, match.id);
  let outcome = await readState(userOutcome.id, match.id);

  assertEq(exact.status, MatchStatus.LIVE, "status meczu = LIVE");
  assertEq(exact.homeScore, 1, "wynik 1:0 zapisany");
  assertEq(exact.pointsEarned, SCORING.OUTCOME, "typ 2:1 przy 1:0 → +1 (wynik)");
  assertEq(exact.totalPoints, 11, "Exact: 10 + 1 = 11");
  assertEq(outcome.pointsEarned, SCORING.EXACT, "typ 1:0 przy 1:0 → +3 (dokładny)");
  assertEq(outcome.totalPoints, 8, "Outcome: 5 + 3 = 8");

  console.log("\n2) LIVE 1:1 — zmiana wyniku, korekta punktów");
  await updateLiveMatchScore(match.id, 1, 1);

  exact = await readState(userExact.id, match.id);
  outcome = await readState(userOutcome.id, match.id);

  assertEq(exact.pointsEarned, SCORING.WRONG, "typ 2:1 przy 1:1 → 0");
  assertEq(exact.totalPoints, 10, "Exact: 11 - 1 = 10");
  assertEq(outcome.pointsEarned, SCORING.WRONG, "typ 1:0 przy 1:1 → 0");
  assertEq(outcome.totalPoints, 5, "Outcome: 8 - 3 = 5");

  console.log("\n3) LIVE 2:1 — wynik zbliża się do typu Exact");
  await updateLiveMatchScore(match.id, 2, 1);

  exact = await readState(userExact.id, match.id);
  outcome = await readState(userOutcome.id, match.id);

  assertEq(exact.pointsEarned, SCORING.EXACT, "typ 2:1 przy 2:1 → +3");
  assertEq(exact.totalPoints, 13, "Exact: 10 + 3 = 13");
  assertEq(outcome.pointsEarned, SCORING.OUTCOME, "typ 1:0 przy 2:1 → +1 (wynik)");
  assertEq(outcome.totalPoints, 6, "Outcome: 5 + 1 = 6");

  console.log("\n4) FINISHED 2:1 — mecz się kończy (bez zmiany punktów)");
  await setMatchResult(match.id, 2, 1);

  exact = await readState(userExact.id, match.id);
  outcome = await readState(userOutcome.id, match.id);

  assertEq(exact.status, MatchStatus.FINISHED, "status = FINISHED");
  assertEq(exact.pointsEarned, SCORING.EXACT, "punkty bez zmian po whiście");
  assertEq(exact.totalPoints, 13, "Exact total bez zmian");
  assertEq(outcome.totalPoints, 6, "Outcome total bez zmian");

  console.log("\n5) Admin poprawia wynik na 2:0 — przeliczenie różnicy");
  await setMatchResult(match.id, 2, 0, null, admin.id);

  exact = await readState(userExact.id, match.id);
  outcome = await readState(userOutcome.id, match.id);

  assertEq(exact.pointsEarned, SCORING.OUTCOME, "typ 2:1 przy 2:0 → +1 (wynik)");
  assertEq(exact.totalPoints, 11, "Exact: 13 - 2 = 11");
  assertEq(outcome.pointsEarned, SCORING.OUTCOME, "typ 1:0 przy 2:0 → +1 (wynik)");
  assertEq(outcome.totalPoints, 6, "Outcome total bez zmian");

  console.log("\n=== Wszystkie scenariusze przeszły pomyślnie ===\n");
}

main()
  .catch((e) => {
    console.error("\n✗ Symulacja nie przeszła:\n", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
