/**
 * Symulacja integracyjna punktacji pucharowej (live + finał + korekta admina).
 * Uruchom: npm run simulate:knockout
 */
import { MatchStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { setMatchResult, updateLiveMatchScore } from "../server/lib/match-service.js";
import { SCORING } from "../shared/scoring.js";

const prisma = new PrismaClient();

const SIM_FIXTURE = 99_998;
const SIM_PREFIX = `__sim_ko_${Date.now()}`;

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
    knockoutWinner: match.knockoutWinner,
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
  console.log("\n=== Symulacja punktacji pucharowej ===\n");

  await cleanup();

  const match = await prisma.match.create({
    data: {
      fixtureNumber: SIM_FIXTURE,
      homeTeam: "Brazylia",
      awayTeam: "Francja",
      kickoffTime: new Date(Date.now() - 60 * 60 * 1000),
      stage: "1/8 finału",
      status: MatchStatus.PENDING,
    },
  });

  const [userExactAdvance, userDrawWrongAdvance, userWrongAdvance, admin] = await Promise.all([
    prisma.user.create({
      data: {
        firstName: "KO",
        lastName: "Exact4",
        nickname: `${SIM_PREFIX}_exact4`,
        password: "sim",
        totalPoints: 0,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "KO",
        lastName: "Draw1",
        nickname: `${SIM_PREFIX}_draw1`,
        password: "sim",
        totalPoints: 0,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "KO",
        lastName: "Only1",
        nickname: `${SIM_PREFIX}_only1`,
        password: "sim",
        totalPoints: 0,
      },
    }),
    prisma.user.create({
      data: {
        firstName: "KO",
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
        userId: userExactAdvance.id,
        matchId: match.id,
        predictedHomeScore: 1,
        predictedAwayScore: 1,
        predictedKnockoutWinner: "HOME",
      },
      {
        userId: userDrawWrongAdvance.id,
        matchId: match.id,
        predictedHomeScore: 0,
        predictedAwayScore: 0,
        predictedKnockoutWinner: "AWAY",
      },
      {
        userId: userWrongAdvance.id,
        matchId: match.id,
        predictedHomeScore: 2,
        predictedAwayScore: 0,
        predictedKnockoutWinner: "HOME",
      },
    ],
  });

  console.log("1) LIVE 1:1 — remis, awans jeszcze nieznany (brak bonusu)");
  await updateLiveMatchScore(match.id, 1, 1);

  let u1 = await readState(userExactAdvance.id, match.id);
  let u2 = await readState(userDrawWrongAdvance.id, match.id);
  let u3 = await readState(userWrongAdvance.id, match.id);

  assertEq(u1.pointsEarned, SCORING.EXACT, "1:1 dokładny → 3 pkt (bez bonusu)");
  assertEq(u1.totalPoints, 3, "Exact4 total = 3");
  assertEq(u2.pointsEarned, SCORING.OUTCOME, "0:0 przy 1:1 → 1 pkt");
  assertEq(u3.pointsEarned, SCORING.WRONG, "2:0 przy 1:1 → 0 pkt (awans nieznany)");

  console.log("\n2) FINISHED 1:1 — awans HOME po karnych (regulamin: 4 / 1 / 1 pkt)");
  await setMatchResult(match.id, 1, 1, "HOME");

  u1 = await readState(userExactAdvance.id, match.id);
  u2 = await readState(userDrawWrongAdvance.id, match.id);
  u3 = await readState(userWrongAdvance.id, match.id);

  assertEq(u1.pointsEarned, SCORING.KNOCKOUT_MAX, "1:1 + awans HOME → 4 pkt");
  assertEq(u1.totalPoints, 4, "Exact4 total = 4");
  assertEq(u2.pointsEarned, SCORING.OUTCOME, "0:0 + zły awans → 1 pkt");
  assertEq(u3.pointsEarned, SCORING.KNOCKOUT_ADVANCE, "2:0 + awans HOME → 1 pkt");
  assertEq(u3.totalPoints, 1, "Only1 total = 1");

  console.log("\n3) Admin zmienia na 2:1 w regulaminie (bez dogrywki)");
  await setMatchResult(match.id, 2, 1, null, admin.id);

  u1 = await readState(userExactAdvance.id, match.id);
  u2 = await readState(userDrawWrongAdvance.id, match.id);
  u3 = await readState(userWrongAdvance.id, match.id);

  assertEq(u1.pointsEarned, 1, "1:1 przy 2:1 + awans HOME → 0+1=1 pkt");
  assertEq(u2.pointsEarned, SCORING.WRONG, "0:0 przy 2:1 + zły awans → 0 pkt");
  assertEq(u3.pointsEarned, 2, "2:0 przy 2:1 + awans HOME → 2 pkt");

  console.log("\n=== Symulacja pucharowa OK ===\n");
}

main()
  .catch((e) => {
    console.error("\n✗ Symulacja pucharowa nie przeszła:\n", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
