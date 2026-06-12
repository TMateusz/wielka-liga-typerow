export type RankSortUser = {
  id: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
};

export function sortUsersForRanking<T extends RankSortUser>(
  users: T[],
  exactHits: Map<string, number>,
): T[] {
  return [...users].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const exactDiff = (exactHits.get(b.id) ?? 0) - (exactHits.get(a.id) ?? 0);
    if (exactDiff !== 0) return exactDiff;
    const nameA = `${a.firstName} ${a.lastName}`;
    const nameB = `${b.firstName} ${b.lastName}`;
    return nameA.localeCompare(nameB, "pl");
  });
}

export function buildRankMap(users: { id: string }[]): Map<string, number> {
  return new Map(users.map((u, index) => [u.id, index + 1]));
}
