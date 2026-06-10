const POLISH_TZ = "Europe/Warsaw";

export function toPolishDateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: POLISH_TZ }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function formatPolishDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: POLISH_TZ,
  }).format(date);
}

export function formatPolishMonthYear(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 1, 12));
  return new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
    timeZone: POLISH_TZ,
  }).format(date);
}

export function formatPolishTime(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: POLISH_TZ,
  }).format(new Date(iso));
}

export const CALENDAR_WEEKDAYS = ["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"] as const;

export function getMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: startPad }, () => null);

  for (let day = 1; day <= last.getDate(); day++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(key);
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shortVenue(venue: string | null): string | null {
  if (!venue) return null;
  const parts = venue.split(",");
  return parts[parts.length - 1]?.trim() ?? venue;
}
