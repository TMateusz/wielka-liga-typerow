import { FormEvent, useState } from "react";
import type { KnockoutSide } from "@shared/knockout";
import { isDrawScore, isKnockoutStage } from "@shared/knockout";
import { KnockoutWinnerPick } from "./KnockoutWinnerPick";
import { ScoreInput } from "./ScoreInput";

type Props = {
  matchId: string;
  stage: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner: string | null;
  finished: boolean;
  onSubmit: (
    matchId: string,
    homeScore: number,
    awayScore: number,
    knockoutWinner: KnockoutSide | null
  ) => Promise<void>;
};

function parseWinner(value: string | null): KnockoutSide | null {
  return value === "HOME" || value === "AWAY" ? value : null;
}

export function AdminResultForm({
  matchId,
  stage,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  knockoutWinner,
  finished,
  onSubmit,
}: Props) {
  const [home, setHome] = useState(homeScore ?? 0);
  const [away, setAway] = useState(awayScore ?? 0);
  const [winner, setWinner] = useState<KnockoutSide | null>(parseWinner(knockoutWinner));
  const [saving, setSaving] = useState(false);

  const knockout = isKnockoutStage(stage);
  const needsWinner = knockout && isDrawScore(home, away);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needsWinner && !winner) return;
    setSaving(true);
    try {
      await onSubmit(matchId, home, away, needsWinner ? winner : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-white/10 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-white/50">{finished ? "Popraw wynik:" : "Wynik:"}</span>
        <ScoreInput
          value={home}
          onChange={setHome}
          aria-label="Bramki gospodarzy"
        />
        <span>:</span>
        <ScoreInput
          value={away}
          onChange={setAway}
          aria-label="Bramki gości"
        />
        <button type="submit" disabled={saving || (needsWinner && !winner)} className="btn-primary ml-1">
          {saving ? "Zapisywanie…" : finished ? "Popraw wynik" : "Zapisz wynik"}
        </button>
      </div>

      {needsWinner && (
        <KnockoutWinnerPick
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          value={winner}
          onChange={setWinner}
        />
      )}
    </form>
  );
}
