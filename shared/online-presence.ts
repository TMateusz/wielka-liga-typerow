/** Uznajemy gracza za „online”, jeśli był aktywny w tym oknie. */
export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export function isUserOnline(
  lastActiveAt: string | Date,
  now: Date = new Date(),
): boolean {
  const then = new Date(lastActiveAt).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then <= ONLINE_THRESHOLD_MS;
}

export function countOnlineUsers(
  users: { lastActiveAt: string | Date }[],
  now: Date = new Date(),
): number {
  return users.filter((u) => isUserOnline(u.lastActiveAt, now)).length;
}

export function formatOnlineCount(count: number): string {
  if (count === 1) return "1 osoba online";
  if (count >= 2 && count <= 4) return `${count} osoby online`;
  return `${count} osób online`;
}
