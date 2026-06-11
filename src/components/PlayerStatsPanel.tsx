import { computePlayerStats } from "@shared/player-stats";
import { formatPoints } from "@shared/scoring";
import { TeamWithFlag } from "./TeamWithFlag";

type Prediction = {
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  predictedKnockoutWinner: string | null;
  pointsEarned: number | null;
};

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  stage: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner: string | null;
};

type Props = {
  userId: string;
  predictions: Prediction[];
  matches: Match[];
};

export function PlayerStatsPanel({ userId, predictions, matches }: Props) {
  const stats = computePlayerStats(
    predictions.filter((p) => p.userId === userId),
    matches,
  );

  if (stats.settledPredictions === 0) {
    return (
      <p className="mb-3 text-sm text-white/45">
        Brak rozliczonych typów — statystyki pojawią się po wpisaniu wyników.
      </p>
    );
  }

  return (
    <div className="mb-4 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm sm:grid-cols-2">
      <div>
        <p className="text-white/45">Skuteczność</p>
        <p className="text-lg font-semibold text-[var(--wc-gold)]">
          {stats.hitRatePercent ?? 0}%
        </p>
        <p className="text-xs text-white/40">{stats.settledPredictions} rozliczonych typów</p>
      </div>
      <div>
        <p className="text-white/45">Trafienia</p>
        <p className="text-white/80">
          <span className="text-green-400">Dokładne: {stats.exactHits}</span>
          {" · "}
          <span className="text-yellow-400">Wynik: {stats.outcomeHits}</span>
          {stats.advanceHits > 0 && (
            <>
              {" · "}
              <span className="text-sky-400">Awans: {stats.advanceHits}</span>
            </>
          )}
          {" · "}
          <span className="text-red-400">Pudła: {stats.wrongHits}</span>
        </p>
      </div>
      {stats.bestMatch && (
        <div className="sm:col-span-2">
          <p className="text-white/45">Najlepszy mecz</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-white/85">
            <TeamWithFlag name={stats.bestMatch.homeTeam} flagWidth={16} />
            <span className="text-white/40">vs</span>
            <TeamWithFlag name={stats.bestMatch.awayTeam} flagWidth={16} />
            <span className="text-[var(--wc-gold)]">
              +{formatPoints(stats.bestMatch.points)} pkt
            </span>
            {stats.bestMatch.stage && (
              <span className="text-xs text-white/40">({stats.bestMatch.stage})</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
