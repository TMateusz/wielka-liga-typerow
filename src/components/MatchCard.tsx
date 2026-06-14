import { FormEvent, useEffect, useState } from "react";
import { Clock, Lock, CheckCircle2, Radio } from "lucide-react";
import type { KnockoutSide } from "@shared/knockout";
import { isKnockoutStage } from "@shared/knockout";
import { formatLiveClockDisplay } from "@shared/live-clock";
import { LIVE_UI_POLL_SEC } from "@shared/live-sync";
import {
  BET_WINDOW_DAYS,
  formatBettingOpensAt,
  formatPoints,
  getPointsToneClass,
  getBetBlockReason,
  isInNextBettingRound,
} from "@shared/scoring";
import { KnockoutWinnerPick } from "./KnockoutWinnerPick";
import { ScoreInput } from "./ScoreInput";
import { TeamWithFlag } from "./TeamWithFlag";

export type MatchData = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: string;
  liveClock?: string | null;
  homeScorers?: string[];
  awayScorers?: string[];
  stage: string | null;
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner?: string | null;
  liveStats?: {
    outcomeDistribution: { home: number; draw: number; away: number };
    exactHitNames: string[];
  } | null;
  prediction: {
    predictedHomeScore: number;
    predictedAwayScore: number;
    predictedKnockoutWinner?: string | null;
    pointsEarned: number | null;
  } | null;
};

type Props = {
  match: MatchData;
  onSave: (
    matchId: string,
    home: number,
    away: number,
    knockoutWinner?: KnockoutSide | null
  ) => Promise<void>;
};

function formatKickoff(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function parseStoredWinner(value: string | null | undefined): KnockoutSide | null {
  return value === "HOME" || value === "AWAY" ? value : null;
}

export function MatchCard({ match, onSave }: Props) {
  const [now, setNow] = useState(() => new Date());
  const kickoff = new Date(match.kickoffTime);
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const liveClockLabel = live ? formatLiveClockDisplay(match.liveClock) : null;
  const showScore = finished || live;
  const knockout = isKnockoutStage(match.stage);
  const blockReason = finished ? null : getBetBlockReason(match.status, kickoff, now);
  const locked = blockReason !== null;
  const tooEarly = blockReason === "too_early";
  const inNextRound = !finished && isInNextBettingRound(match.status, kickoff, now);

  useEffect(() => {
    if (finished || blockReason === "started" || blockReason === "not_pending") return;

    const msToKickoff = kickoff.getTime() - Date.now();
    const intervalMs =
      tooEarly && msToKickoff > 6 * 60 * 60 * 1000
        ? 5 * 60 * 1000
        : msToKickoff <= 5 * 60 * 1000
          ? 1_000
          : 30_000;

    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [match.kickoffTime, match.status, finished, blockReason, tooEarly]);

  const [home, setHome] = useState(match.prediction?.predictedHomeScore ?? 0);
  const [away, setAway] = useState(match.prediction?.predictedAwayScore ?? 0);
  const [knockoutWinner, setKnockoutWinner] = useState<KnockoutSide | null>(
    parseStoredWinner(match.prediction?.predictedKnockoutWinner)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const showKnockoutPick = knockout && !locked && !finished;
  const storedKnockoutWinner = parseStoredWinner(match.knockoutWinner);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (showKnockoutPick && !knockoutWinner) {
      setMessage("Wybierz drużynę, która awansuje");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave(match.id, home, away, knockout ? knockoutWinner : null);
      setMessage("Typ zapisany!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się zapisać typu.");
    } finally {
      setSaving(false);
    }
  }

  const winnerTeam =
    storedKnockoutWinner === "HOME"
      ? match.homeTeam
      : storedKnockoutWinner === "AWAY"
        ? match.awayTeam
        : null;

  return (
    <article
      id={`match-${match.id}`}
      className={`card-pitch p-4 sm:p-5 ${
        live
          ? "ring-1 ring-red-500/40 border-red-500/25"
          : inNextRound
            ? "ring-1 ring-[var(--wc-gold)]/35 border-[var(--wc-gold)]/25"
            : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/60">
        <span className="flex flex-wrap items-center gap-2">
          {match.stage ?? "Mecz"}
          {live && (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">
              <Radio className="h-3 w-3 animate-pulse" />
              Na żywo
              {liveClockLabel && (
                <span className="font-mono normal-case tracking-normal text-red-200/95">
                  · {liveClockLabel}
                </span>
              )}
            </span>
          )}
          {inNextRound && (
            <span className="rounded bg-[var(--wc-gold)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--wc-gold)]">
              Kolejka kolejna
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {locked || tooEarly ? (
            <Lock className={`h-3.5 w-3.5 ${tooEarly ? "text-white/35" : ""}`} />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          {formatKickoff(match.kickoffTime)}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <TeamWithFlag
            name={match.homeTeam}
            layout="stack"
            flagWidth={28}
            nameClassName="text-lg font-bold sm:text-xl"
          />
          {showScore && match.homeScore != null && (
            <p
              className={`text-3xl font-black ${live ? "text-red-300" : "text-[var(--gold)]"}`}
            >
              {match.homeScore}
            </p>
          )}
          {live && (match.homeScorers?.length ?? 0) > 0 && (
            <ul className="mt-1 w-full space-y-0.5 text-[11px] leading-tight text-white/50">
              {match.homeScorers!.map((scorer, i) => (
                <li key={`${scorer}-${i}`}>⚽ {scorer}</li>
              ))}
            </ul>
          )}
        </div>
        <span className="text-white/40">vs</span>
        <div className="flex flex-col items-center gap-1">
          <TeamWithFlag
            name={match.awayTeam}
            layout="stack"
            flagWidth={28}
            nameClassName="text-lg font-bold sm:text-xl"
          />
          {showScore && match.awayScore != null && (
            <p
              className={`text-3xl font-black ${live ? "text-red-300" : "text-[var(--gold)]"}`}
            >
              {match.awayScore}
            </p>
          )}
          {live && (match.awayScorers?.length ?? 0) > 0 && (
            <ul className="mt-1 w-full space-y-0.5 text-[11px] leading-tight text-white/50">
              {match.awayScorers!.map((scorer, i) => (
                <li key={`${scorer}-${i}`}>⚽ {scorer}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {finished && winnerTeam && match.homeScore === match.awayScore && (
        <p className="mb-3 text-center text-sm text-white/55">
          Po dogrywce / karnych: <span className="font-medium text-white/80">{winnerTeam}</span>
        </p>
      )}

      {showScore && match.prediction?.pointsEarned != null && (
        <p
          className={`mb-3 flex items-center justify-center gap-1 text-sm ${
            live ? getPointsToneClass(match.prediction.pointsEarned) : "text-[var(--gold)]"
          }`}
        >
          {live ? (
            <Radio className="h-4 w-4 animate-pulse" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {live ? "Punkty na żywo" : "Zdobyte punkty"}: {formatPoints(match.prediction.pointsEarned)}
          {live && (
            <span className="text-white/55">
              Twój typ: {match.prediction.predictedHomeScore}:{match.prediction.predictedAwayScore}
            </span>
          )}
        </p>
      )}

      {live && match.prediction?.pointsEarned == null && (
        <p className="mb-3 text-center text-sm text-red-300/80">
          Mecz trwa — wynik i punkty odświeżają się co {LIVE_UI_POLL_SEC} sekund.
        </p>
      )}

      {live && match.liveStats && (
        <div className="mb-3 space-y-1.5">
          {(() => {
            const { home: h, draw: d, away: a } = match.liveStats.outcomeDistribution;
            const total = h + d + a;
            if (total === 0) return null;
            const pctH = Math.round((h / total) * 100);
            const pctD = Math.round((d / total) * 100);
            const pctA = Math.round((a / total) * 100);
            return (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="w-7 text-right font-mono text-white/50">{pctH}%</span>
                <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  {pctH > 0 && <div className="bg-emerald-400/70" style={{ width: `${pctH}%` }} />}
                  {pctD > 0 && <div className="bg-white/40" style={{ width: `${pctD}%` }} />}
                  {pctA > 0 && <div className="bg-sky-400/70" style={{ width: `${pctA}%` }} />}
                </div>
                <span className="w-7 font-mono text-white/50">{pctA}%</span>
              </div>
            );
          })()}
          {(() => {
            const { home: h, draw: d, away: a } = match.liveStats.outcomeDistribution;
            const total = h + d + a;
            if (total === 0) return null;
            return (
              <p className="text-center text-[10px] text-white/40">
                {h} na {match.homeTeam} · {d} remis · {a} na {match.awayTeam}
              </p>
            );
          })()}
          {match.liveStats.exactHitNames.length > 0 ? (
            <p className="text-center text-[10px] text-green-400/80">
              🎯 3 pkt: {match.liveStats.exactHitNames.join(", ")}
            </p>
          ) : (
            <p className="text-center text-[10px] text-white/35">
              🎯 3 pkt: brak
            </p>
          )}
        </div>
      )}

      {!finished && !live && (
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <ScoreInput
              value={home}
              onChange={setHome}
              disabled={locked}
              aria-label={`Bramki ${match.homeTeam}`}
            />
            <span className="text-white/50">:</span>
            <ScoreInput
              value={away}
              onChange={setAway}
              disabled={locked}
              aria-label={`Bramki ${match.awayTeam}`}
            />
          </div>

          {showKnockoutPick && (
            <KnockoutWinnerPick
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              value={knockoutWinner}
              onChange={setKnockoutWinner}
              disabled={locked}
            />
          )}

          {locked ? (
            <p className="flex items-center justify-center gap-1.5 text-sm text-white/50">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              {tooEarly ? (
                <>
                  Typowanie od {formatBettingOpensAt(kickoff)}
                  <span className="text-white/35">(max. {BET_WINDOW_DAYS} dni przed meczem)</span>
                </>
              ) : (
                "Typowanie zablokowane — mecz się rozpoczął"
              )}
            </p>
          ) : (
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Zapisywanie…" : match.prediction ? "Zaktualizuj typ" : "Zapisz typ"}
            </button>
          )}

          {message && <p className="text-sm text-[var(--gold)]">{message}</p>}
        </form>
      )}
    </article>
  );
}
