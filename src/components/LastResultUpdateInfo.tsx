import { formatLastActive } from "@shared/relative-time";

export type LastResultUpdate = {
  at: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

export function LastResultUpdateInfo({ update }: { update: LastResultUpdate | null }) {
  if (!update) {
    return (
      <p className="text-sm text-white/45">
        Administrator nie zatwierdził jeszcze żadnego wyniku meczu.
      </p>
    );
  }

  return (
    <p className="text-sm text-white/50">
      Ostatnia aktualizacja wyników:{" "}
      <time className="text-white/75" dateTime={update.at}>
        {formatLastActive(update.at)}
      </time>
      {" · "}
      <span className="text-white/65">
        {update.homeTeam} {update.homeScore}:{update.awayScore} {update.awayTeam}
      </span>
    </p>
  );
}
