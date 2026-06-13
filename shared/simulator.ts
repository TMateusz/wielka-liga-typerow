/** Gra towarzyska — punkty aktywności, bez wpływu na ranking główny. */

export const SIMULATOR_INITIAL_BALANCE = 1000;
export const SIMULATOR_MIN_STAKE = 10;
export const SIMULATOR_MAX_STAKE = 500;

/** Punkty aktywności za działania w lidze (nie wpływają na ranking punktowy). */
export const ACTIVITY_REWARDS = {
  /** Zapis typu na mecz (raz na mecz). */
  BET_PLACED: 5,
  /** Mnożnik punktów aktywności za punkty ligowe po meczu (1→10, 3→30, 4→40). */
  PREDICTION_ACTIVITY_MULTIPLIER: 10,
  pointsToActivity(points: number): number {
    if (points >= 4) return 4 * ACTIVITY_REWARDS.PREDICTION_ACTIVITY_MULTIPLIER;
    if (points >= 3) return 3 * ACTIVITY_REWARDS.PREDICTION_ACTIVITY_MULTIPLIER;
    if (points >= 1) return 1 * ACTIVITY_REWARDS.PREDICTION_ACTIVITY_MULTIPLIER;
    return 0;
  },
  CHAT_MESSAGE: 3,
  CHAT_HEART: 1,
  ONLINE_SESSION: 5,
  REWARD_INTERVAL_MS: 15 * 60 * 1000,
} as const;

/** @deprecated Użyj ACTIVITY_REWARDS */
export const TOKEN_REWARDS = ACTIVITY_REWARDS;

export const ACTIVITY_EARNING_RULES = [
  { id: "bet", label: "Zapis typu na mecz", amount: ACTIVITY_REWARDS.BET_PLACED, note: "raz na mecz" },
  {
    id: "outcome",
    label: "Trafiony wynik (1 pkt w lidze)",
    amount: 1 * ACTIVITY_REWARDS.PREDICTION_ACTIVITY_MULTIPLIER,
    note: "po zakończeniu meczu",
  },
  {
    id: "exact",
    label: "Dokładny wynik (3 pkt w lidze)",
    amount: 3 * ACTIVITY_REWARDS.PREDICTION_ACTIVITY_MULTIPLIER,
    note: "po zakończeniu meczu",
  },
  {
    id: "knockout",
    label: "Typ pucharowy max (4 pkt)",
    amount: 4 * ACTIVITY_REWARDS.PREDICTION_ACTIVITY_MULTIPLIER,
    note: "po zakończeniu meczu",
  },
  {
    id: "chat",
    label: "Wiadomość na czacie",
    amount: ACTIVITY_REWARDS.CHAT_MESSAGE,
    note: "co 15 min (nie za każdą wiadomość)",
  },
  { id: "heart", label: "Reakcja na wiadomość", amount: ACTIVITY_REWARDS.CHAT_HEART, note: "każde serduszko" },
  {
    id: "online",
    label: "Aktywność online",
    amount: ACTIVITY_REWARDS.ONLINE_SESSION,
    note: "co 15 min korzystania z aplikacji",
  },
] as const;

/** @deprecated Użyj ACTIVITY_EARNING_RULES */
export const TOKEN_EARNING_RULES = ACTIVITY_EARNING_RULES;
export type VirtualBetSelection = "HOME" | "DRAW" | "AWAY";

export type VirtualBetStatus = "PENDING" | "WON" | "LOST" | "VOID";

export function formatOddsDecimal(value: number): string {
  return value.toFixed(2);
}

export function formatActivityPoints(amount: number): string {
  return new Intl.NumberFormat("pl-PL").format(amount);
}

/** @deprecated Użyj formatActivityPoints */
export const formatVirtualCoins = formatActivityPoints;

export function selectionLabel(selection: VirtualBetSelection, homeTeam: string, awayTeam: string): string {
  if (selection === "HOME") return `1 — ${homeTeam}`;
  if (selection === "AWAY") return `2 — ${awayTeam}`;
  return "X — remis";
}

export function potentialPayout(stake: number, odds: number): number {
  return Math.floor(stake * odds);
}
