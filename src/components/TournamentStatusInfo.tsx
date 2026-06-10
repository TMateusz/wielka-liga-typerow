import { LastResultUpdateInfo, type LastResultUpdate } from "./LastResultUpdateInfo";

export type TournamentProgress = {
  totalMatches: number;
  settledMatches: number;
};

type Props = {
  lastResultUpdate: LastResultUpdate | null;
  tournamentProgress: TournamentProgress | null;
};

export function TournamentStatusInfo({ lastResultUpdate, tournamentProgress }: Props) {
  const total = tournamentProgress?.totalMatches ?? 0;
  const settled = tournamentProgress?.settledMatches ?? 0;
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0;

  return (
    <div className="card-pitch space-y-2 p-4 text-sm">
      {tournamentProgress && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-white/60">
            Postęp turnieju:{" "}
            <strong className="text-white/85">
              {settled}/{total} meczów rozliczonych
            </strong>
            <span className="text-white/45"> ({percent}%)</span>
          </p>
          <div className="h-1.5 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-white/10 sm:max-w-xs">
            <div
              className="h-full rounded-full bg-[var(--wc-gold)] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      <LastResultUpdateInfo update={lastResultUpdate} />
    </div>
  );
}
