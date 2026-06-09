/** Po polsku — „5 min temu”, „wczoraj” itd. */
export function formatLastActive(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "brak danych";

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "brak danych";

  const diffMs = Math.max(0, now - then);
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min temu`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} godz. temu`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "wczoraj";
  if (diffDays < 7) return `${diffDays} dni temu`;

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  }).format(then);
}
