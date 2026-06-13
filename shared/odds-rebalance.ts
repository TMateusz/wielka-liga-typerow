export type OddsTriple = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
};

export type OddsField = keyof OddsTriple;

const MIN_ODD = 1.01;
const MAX_ODD = 50;

function roundOdd(value: number): number {
  return Math.round(Math.max(MIN_ODD, Math.min(MAX_ODD, value)) * 100) / 100;
}

function impliedProbs(odds: OddsTriple) {
  return {
    homeOdds: 1 / odds.homeOdds,
    drawOdds: 1 / odds.drawOdds,
    awayOdds: 1 / odds.awayOdds,
  };
}

/**
 * Zmiana jednego kursu przy stałej marży buka — pozostałe dwa wyniki przeliczane proporcjonalnie.
 * Niższy kurs na gospodarzy → wyższy na gości (i odwrotnie).
 */
export function rebalanceOdds(
  current: OddsTriple,
  field: OddsField,
  newValue: number,
): OddsTriple {
  if (!Number.isFinite(newValue) || newValue < MIN_ODD) {
    throw new Error(`Kurs musi być co najmniej ${MIN_ODD}`);
  }

  const changedOdd = roundOdd(newValue);
  const probs = impliedProbs(current);
  const margin = probs.homeOdds + probs.drawOdds + probs.awayOdds;
  const changedProb = 1 / changedOdd;
  const rest = margin - changedProb;

  if (rest < 0.015) {
    throw new Error("Kurs zbyt niski — zwiększ go lub obniż inny wynik");
  }

  const otherFields = (["homeOdds", "drawOdds", "awayOdds"] as const).filter((f) => f !== field);
  const otherSum = probs[otherFields[0]] + probs[otherFields[1]];

  const result: OddsTriple = {
    homeOdds: current.homeOdds,
    drawOdds: current.drawOdds,
    awayOdds: current.awayOdds,
  };
  result[field] = changedOdd;
  result[otherFields[0]] = roundOdd(1 / (rest * (probs[otherFields[0]] / otherSum)));
  result[otherFields[1]] = roundOdd(1 / (rest * (probs[otherFields[1]] / otherSum)));

  return result;
}

export function marginPercent(odds: OddsTriple): number {
  const p = impliedProbs(odds);
  return Math.round((p.homeOdds + p.drawOdds + p.awayOdds - 1) * 1000) / 10;
}
