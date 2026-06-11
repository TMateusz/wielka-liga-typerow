/** Zmiana pozycji: dodatnia = awans w górę tabeli, 0 = bez zmian, null = brak danych. */
export function computeRankChange(
  previousRank: number | undefined,
  currentRank: number,
): number | null {
  if (previousRank === undefined) return null;
  if (previousRank === currentRank) return 0;
  return previousRank - currentRank;
}
