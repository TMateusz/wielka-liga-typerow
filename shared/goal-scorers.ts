/** Parsuje format worldcup26 (`{"J. Quinones 9'","R. Jiménez 67'"}` lub tablica JSON). */
export function parseWc2026Scorers(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter((s) => s.length > 0);
    }
  } catch {
    // nieprawidłowy JSON — próba formatu „zbioru” z API
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1);
    const items: string[] = [];
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(inner)) !== null) {
      items.push(match[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
    return items;
  }

  return [trimmed];
}

export function serializeScorers(scorers: string[]): string | null {
  return scorers.length > 0 ? JSON.stringify(scorers) : null;
}

export function parseStoredScorers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}
