/**
 * Testy jednostkowe punktacji — wszystkie scenariusze z regulaminu + przypadki brzegowe.
 * Uruchom: npm run test:scoring
 */
import { resolveActualKnockoutWinner } from "../shared/knockout.js";
import {
  calculatePoints,
  calculateRegulationPoints,
  isExactScorePrediction,
  SCORING,
  type ScoreInput,
} from "../shared/scoring.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed++;
    console.error(`  ✗ ${label}`);
    return;
  }
  passed++;
  console.log(`  ✓ ${label}`);
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  assert(actual === expected, `${label} (oczekiwano ${expected}, jest ${actual})`);
}

function runCases(title: string, cases: { label: string; input: ScoreInput; expected: number }[]) {
  console.log(`\n${title}`);
  for (const c of cases) {
    assertEq(calculatePoints(c.input), c.expected, c.label);
  }
}

console.log("\n=== Testy jednostkowe punktacji ===");

// ── Faza grupowa ─────────────────────────────────────────────
runCases("Faza grupowa", [
  {
    label: "Dokładny wynik 2:1",
    input: { predictedHome: 2, predictedAway: 1, actualHome: 2, actualAway: 1, stage: "Grupa A" },
    expected: 3,
  },
  {
    label: "Poprawny wynik (zwycięzca gospodarzy) 1:0 → 3:1",
    input: { predictedHome: 1, predictedAway: 0, actualHome: 3, actualAway: 1, stage: "Grupa B" },
    expected: 1,
  },
  {
    label: "Poprawny wynik (zwycięzca gości) 0:2 → 1:3",
    input: { predictedHome: 0, predictedAway: 2, actualHome: 1, actualAway: 3, stage: "Grupa C" },
    expected: 1,
  },
  {
    label: "Poprawny remis 1:1 → 2:2",
    input: { predictedHome: 1, predictedAway: 1, actualHome: 2, actualAway: 2, stage: "Grupa D" },
    expected: 1,
  },
  {
    label: "Błędny typ 0:1 przy 2:0",
    input: { predictedHome: 0, predictedAway: 1, actualHome: 2, actualAway: 0, stage: "Grupa E" },
    expected: 0,
  },
  {
    label: "Błędny typ 2:0 przy 0:0",
    input: { predictedHome: 2, predictedAway: 0, actualHome: 0, actualAway: 0, stage: "Grupa F" },
    expected: 0,
  },
  {
    label: "Remis 0:0 dokładny",
    input: { predictedHome: 0, predictedAway: 0, actualHome: 0, actualAway: 0, stage: "Grupa G" },
    expected: 3,
  },
  {
    label: "Wysokie wyniki 4:3 dokładny",
    input: { predictedHome: 4, predictedAway: 3, actualHome: 4, actualAway: 3, stage: "Grupa H" },
    expected: 3,
  },
  {
    label: "Pole awansu ignorowane w grupie",
    input: {
      predictedHome: 1,
      predictedAway: 0,
      actualHome: 1,
      actualAway: 0,
      stage: "Grupa A",
      predictedKnockoutWinner: "HOME",
      actualKnockoutWinner: "AWAY",
    },
    expected: 3,
  },
]);

// ── Regulamin: przykłady pucharowe (1:1, awans HOME) ─────────
runCases("Faza pucharowa — przykłady z regulaminu", [
  {
    label: "Regulamin: 1:1 + awans HOME → 4 pkt",
    input: {
      predictedHome: 1,
      predictedAway: 1,
      actualHome: 1,
      actualAway: 1,
      stage: "1/8 finału",
      predictedKnockoutWinner: "HOME",
      actualKnockoutWinner: "HOME",
    },
    expected: 4,
  },
  {
    label: "Regulamin: 0:0 + awans Francja (AWAY) przy awansie HOME → 1 pkt",
    input: {
      predictedHome: 0,
      predictedAway: 0,
      actualHome: 1,
      actualAway: 1,
      stage: "1/8 finału",
      predictedKnockoutWinner: "AWAY",
      actualKnockoutWinner: "HOME",
    },
    expected: 1,
  },
  {
    label: "Regulamin: 2:0 + awans HOME przy 1:1 → 1 pkt",
    input: {
      predictedHome: 2,
      predictedAway: 0,
      actualHome: 1,
      actualAway: 1,
      stage: "1/8 finału",
      predictedKnockoutWinner: "HOME",
      actualKnockoutWinner: "HOME",
    },
    expected: 1,
  },
]);

// ── Wygrana w regulaminowym czasie (bez dogrywki) ────────────
runCases("Faza pucharowa — wygrana w 90′", [
  {
    label: "2:1 dokładny + awans HOME → 4 pkt",
    input: {
      predictedHome: 2,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 1,
      stage: "1/4 finału",
      predictedKnockoutWinner: "HOME",
      actualKnockoutWinner: null,
    },
    expected: 4,
  },
  {
    label: "2:1 dokładny + zły awans AWAY → 3 pkt",
    input: {
      predictedHome: 2,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 1,
      stage: "1/4 finału",
      predictedKnockoutWinner: "AWAY",
      actualKnockoutWinner: null,
    },
    expected: 3,
  },
  {
    label: "1:0 wynik + awans HOME przy 2:0 → 2 pkt",
    input: {
      predictedHome: 1,
      predictedAway: 0,
      actualHome: 2,
      actualAway: 0,
      stage: "Półfinał",
      predictedKnockoutWinner: "HOME",
      actualKnockoutWinner: null,
    },
    expected: 2,
  },
  {
    label: "0:2 wynik + awans AWAY przy 0:3 → 2 pkt",
    input: {
      predictedHome: 0,
      predictedAway: 2,
      actualHome: 0,
      actualAway: 3,
      stage: "Finał",
      predictedKnockoutWinner: "AWAY",
      actualKnockoutWinner: null,
    },
    expected: 2,
  },
  {
    label: "0:2 wynik + zły awans HOME przy 0:3 → 1 pkt",
    input: {
      predictedHome: 0,
      predictedAway: 2,
      actualHome: 0,
      actualAway: 3,
      stage: "Finał",
      predictedKnockoutWinner: "HOME",
      actualKnockoutWinner: null,
    },
    expected: 1,
  },
]);

// ── Remis po 90′ + karny/dogrywka ────────────────────────────
runCases("Faza pucharowa — remis po 90′", [
  {
    label: "1:1 dokładny + zły awans → 3 pkt",
    input: {
      predictedHome: 1,
      predictedAway: 1,
      actualHome: 1,
      actualAway: 1,
      stage: "1/16 finału",
      predictedKnockoutWinner: "AWAY",
      actualKnockoutWinner: "HOME",
    },
    expected: 3,
  },
  {
    label: "2:2 wynik + trafiony awans → 2 pkt",
    input: {
      predictedHome: 1,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 2,
      stage: "1/16 finału",
      predictedKnockoutWinner: "AWAY",
      actualKnockoutWinner: "AWAY",
    },
    expected: 2,
  },
  {
    label: "0:0 remis + brak trafionego awansu → 1 pkt",
    input: {
      predictedHome: 0,
      predictedAway: 0,
      actualHome: 1,
      actualAway: 1,
      stage: "1/16 finału",
      predictedKnockoutWinner: "AWAY",
      actualKnockoutWinner: "HOME",
    },
    expected: 1,
  },
  {
    label: "Całkowite pudło 2:0 przy 1:1 + zły awans → 0 pkt",
    input: {
      predictedHome: 2,
      predictedAway: 0,
      actualHome: 1,
      actualAway: 1,
      stage: "1/16 finału",
      predictedKnockoutWinner: "AWAY",
      actualKnockoutWinner: "HOME",
    },
    expected: 0,
  },
  {
    label: "Tylko bonus awansu (0+1) przy 1:1",
    input: {
      predictedHome: 3,
      predictedAway: 0,
      actualHome: 1,
      actualAway: 1,
      stage: "1/16 finału",
      predictedKnockoutWinner: "HOME",
      actualKnockoutWinner: "HOME",
    },
    expected: 1,
  },
]);

// ── Wszystkie możliwe sumy w pucharze ────────────────────────
console.log("\nFaza pucharowa — możliwe sumy punktów (0–4)");
const knockoutSums = new Set<number>();
for (const reg of [0, 1, 3]) {
  for (const adv of [0, 1]) {
    knockoutSums.add(reg + adv);
  }
}
assert(knockoutSums.has(0), "możliwe 0 pkt");
assert(knockoutSums.has(1), "możliwe 1 pkt");
assert(knockoutSums.has(2), "możliwe 2 pkt");
assert(knockoutSums.has(3), "możliwe 3 pkt");
assert(knockoutSums.has(4), "możliwe 4 pkt");
assert(!knockoutSums.has(5), "brak 5 pkt w pucharze");

// ── resolveActualKnockoutWinner ──────────────────────────────
console.log("\nresolveActualKnockoutWinner");
assertEq(resolveActualKnockoutWinner(2, 1, null), "HOME", "2:1 → awans HOME");
assertEq(resolveActualKnockoutWinner(0, 3, null), "AWAY", "0:3 → awans AWAY");
assertEq(resolveActualKnockoutWinner(1, 1, "AWAY"), "AWAY", "1:1 + karny AWAY");
assertEq(resolveActualKnockoutWinner(1, 1, null), null, "1:1 bez zwycięzcy → null");

// ── isExactScorePrediction (remisy w tabeli) ─────────────────
console.log("\nisExactScorePrediction (tie-breaker)");
assert(isExactScorePrediction(2, 1, 2, 1), "trafiony dokładny");
assert(!isExactScorePrediction(1, 0, 3, 1), "tylko wynik, nie dokładny");
assert(!isExactScorePrediction(1, 0, null, 1), "brak wyniku w bazie");

// ── calculateRegulationPoints izolowanie ─────────────────────
console.log("\ncalculateRegulationPoints");
assertEq(calculateRegulationPoints(2, 1, 2, 1), 3, "regulacja 3");
assertEq(calculateRegulationPoints(1, 0, 2, 0), 1, "regulacja 1 (ten sam zwycięzca)");
assertEq(calculateRegulationPoints(1, 0, 0, 2), 0, "regulacja 0 (zły zwycięzca)");

console.log(`\n=== Podsumowanie: ${passed} OK, ${failed} błędów ===\n`);
if (failed > 0) process.exitCode = 1;
