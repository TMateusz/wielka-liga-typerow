export type StageTab = {
  id: string;
  label: string;
  title?: string;
  matchStages?: string[];
};

export function isFinishedMatch(match: { status: string }): boolean {
  return match.status === "FINISHED";
}

export const STAGE_TABS: StageTab[] = [
  { id: "all", label: "Wszystkie", title: "Nadchodzące mecze" },
  ...(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const).map((letter) => ({
    id: `group-${letter}`,
    label: letter,
    title: `Grupa ${letter}`,
    matchStages: [`Grupa ${letter}`],
  })),
  { id: "r16", label: "1/16", title: "1/16 finału", matchStages: ["1/16 finału"] },
  { id: "r8", label: "1/8", title: "1/8 finału", matchStages: ["1/8 finału"] },
  { id: "r4", label: "1/4", title: "Ćwierćfinał", matchStages: ["Ćwierćfinał"] },
  { id: "r2", label: "1/2", title: "Półfinał", matchStages: ["Półfinał"] },
  { id: "third", label: "3.", title: "Mecz o 3. miejsce", matchStages: ["Mecz o 3. miejsce"] },
  { id: "final", label: "Finał", title: "Finał", matchStages: ["Finał"] },
  { id: "finished", label: "Zakończone", title: "Zakończone mecze" },
];

export function filterMatchesByTab<T extends { stage: string | null; status: string }>(
  matches: T[],
  tabId: string
): T[] {
  if (tabId === "finished") {
    return matches.filter(isFinishedMatch);
  }

  if (tabId === "all") {
    return matches.filter((m) => !isFinishedMatch(m));
  }

  const tab = STAGE_TABS.find((t) => t.id === tabId);
  if (!tab?.matchStages) {
    return matches.filter((m) => !isFinishedMatch(m));
  }

  return matches.filter((m) => tab.matchStages!.includes(m.stage ?? ""));
}

export function getStageTabLabel(tabId: string): string {
  const tab = STAGE_TABS.find((t) => t.id === tabId);
  return tab?.title ?? tab?.label ?? tabId;
}
