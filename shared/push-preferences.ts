/**
 * Push notification categories that users can toggle on/off.
 * Stored as JSON string in User.pushPreferences.
 */
export type PushPreferences = {
  /** 2h przed meczem — nie masz typu */
  missingBet: boolean;
  /** Po meczu — zdobyte punkty */
  pointsEarned: boolean;
  /** Ktoś Cię @oznaczył */
  mention: boolean;
  /** Ktoś odpowiedział na Twoją wiadomość */
  reply: boolean;
  /** LIVE: mecz się zaczął */
  matchStarted: boolean;
  /** LIVE: mecz się skończył */
  matchFinished: boolean;
  /** LIVE: padł gol */
  goal: boolean;
};

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  missingBet: true,
  pointsEarned: true,
  mention: true,
  reply: true,
  matchStarted: false,
  matchFinished: false,
  goal: false,
};

export function parsePushPreferences(json: string | null | undefined): PushPreferences {
  if (!json) return { ...DEFAULT_PUSH_PREFERENCES };
  try {
    const parsed = JSON.parse(json);
    return {
      missingBet: parsed.missingBet ?? DEFAULT_PUSH_PREFERENCES.missingBet,
      pointsEarned: parsed.pointsEarned ?? DEFAULT_PUSH_PREFERENCES.pointsEarned,
      mention: parsed.mention ?? DEFAULT_PUSH_PREFERENCES.mention,
      reply: parsed.reply ?? DEFAULT_PUSH_PREFERENCES.reply,
      matchStarted: parsed.matchStarted ?? DEFAULT_PUSH_PREFERENCES.matchStarted,
      matchFinished: parsed.matchFinished ?? DEFAULT_PUSH_PREFERENCES.matchFinished,
      goal: parsed.goal ?? DEFAULT_PUSH_PREFERENCES.goal,
    };
  } catch {
    return { ...DEFAULT_PUSH_PREFERENCES };
  }
}

export type PushCategory = keyof PushPreferences;

export const PUSH_CATEGORY_LABELS: Record<PushCategory, { label: string; description: string; section: "general" | "live" }> = {
  missingBet: { label: "Brak typu", description: "2h przed meczem, gdy nie masz wytypowanego wyniku", section: "general" },
  pointsEarned: { label: "Zdobyte punkty", description: "Po zakończeniu meczu — ile punktów zdobyłeś", section: "general" },
  mention: { label: "Wzmianka na czacie", description: "Ktoś Cię @oznaczył w wiadomości", section: "general" },
  reply: { label: "Odpowiedź na czacie", description: "Ktoś odpowiedział na Twoją wiadomość", section: "general" },
  matchStarted: { label: "Mecz się zaczął", description: "Powiadomienie na start każdego meczu", section: "live" },
  matchFinished: { label: "Mecz się skończył", description: "Wynik końcowy po gwizdku", section: "live" },
  goal: { label: "Gol!", description: "Aktualny wynik i Twoje punkty po każdym golu", section: "live" },
};
