export type UserNameFields = {
  firstName: string;
  lastName: string;
  nickname: string;
};

export function getDisplayName(user: UserNameFields): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function getShortName(user: UserNameFields): string {
  return user.firstName;
}

export function getInitials(user: UserNameFields): string {
  const first = user.firstName.trim().charAt(0).toUpperCase();
  const last = user.lastName.trim().charAt(0).toUpperCase();
  if (first && last) return `${first}${last}`;
  if (first) return first;
  if (last) return last;
  return user.nickname.slice(0, 2).toUpperCase();
}

/** Kolejność jak w rankingu: punkty malejąco, potem nazwisko. */
export function orderUsersForTipsTable<T extends UserNameFields & { totalPoints?: number }>(
  users: T[]
): T[] {
  return [...users].sort((a, b) => {
    const ptsDiff = (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
    if (ptsDiff !== 0) return ptsDiff;
    const byName = getDisplayName(a).localeCompare(getDisplayName(b), "pl");
    if (byName !== 0) return byName;
    return a.nickname.localeCompare(b.nickname, "pl");
  });
}

export function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export function isValidNickname(nickname: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(nickname.trim());
}
