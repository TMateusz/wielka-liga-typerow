/** Ostatnia aktualizacja regulaminu (czas polski). */
export const RULES_LAST_UPDATED_AT = new Date("2026-06-10T16:00:00+02:00");

export function formatRulesLastUpdated(): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(RULES_LAST_UPDATED_AT);
}
