/** Zmiana pozycji w całej tabeli: dodatnia = awans, 0 = bez zmian, null = brak danych. */
export function computeRankChange(
  previousRank: number | undefined,
  currentRank: number,
): number | null {
  if (previousRank === undefined) return null;
  if (previousRank === currentRank) return 0;
  return previousRank - currentRank;
}

/**
 * Δ w top N: ile graczy z poprzedniej top N ktoś wyprzedził od startu kolejki.
 * Np. z 14. na 8. — przeskoczył 3 osoby z dawnej top 10 (były 8., 9., 10.).
 */
export function computeTopNRankChange(
  userId: string,
  prevRanks: ReadonlyMap<string, number>,
  currRanks: ReadonlyMap<string, number>,
  topN: number,
): number | null {
  const prevRank = prevRanks.get(userId);
  const currRank = currRanks.get(userId);
  if (prevRank === undefined || currRank === undefined) return null;
  if (prevRank === currRank) return 0;

  if (currRank < prevRank) {
    let passed = 0;
    for (const [id, theirPrev] of prevRanks) {
      if (id === userId || theirPrev > topN) continue;
      const theirCurr = currRanks.get(id);
      if (theirCurr === undefined) continue;
      if (theirPrev < prevRank && theirCurr > currRank) passed++;
    }
    return passed;
  }

  let passedBy = 0;
  for (const [id, theirPrev] of prevRanks) {
    if (id === userId || theirPrev > topN) continue;
    const theirCurr = currRanks.get(id);
    if (theirCurr === undefined) continue;
    if (theirPrev > prevRank && theirCurr < currRank) passedBy++;
  }
  return -passedBy;
}
