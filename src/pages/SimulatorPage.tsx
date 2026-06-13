import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Gamepad2, Info, Trophy } from "lucide-react";
import {
  formatOddsDecimal,
  formatActivityPoints,
  potentialPayout,
  selectionLabel,
  type VirtualBetSelection,
} from "@shared/simulator";
import { api } from "../api/client";
import { TeamWithFlag } from "../components/TeamWithFlag";
import { LoadingScreen } from "../components/LoadingScreen";
import { RefreshButton } from "../components/RefreshButton";
import { SimulatorTermsModal } from "../components/simulator/SimulatorTermsModal";

type BettableMatch = {
  id: string;
  fixtureNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  stage: string | null;
  odds: {
    home: number;
    draw: number;
    away: number;
    source: string;
    fetchedAt: string;
  } | null;
  userBet: {
    id: string;
    selection: VirtualBetSelection;
    stake: number;
    odds: number;
    status: string;
  } | null;
};

type BetHistoryItem = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  selection: VirtualBetSelection;
  stake: number;
  odds: number;
  status: string;
  payout: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

type SimulatorState = {
  hasAcceptedSimulatorTerms: boolean;
  disclaimer?: string;
  wallet?: { balance: number };
  earningRules?: { id: string; label: string; amount: number; note: string }[];
  recentEarnings?: { amount: number; reason: string; createdAt: string }[];
  bettableMatches?: BettableMatch[];
  betHistory?: BetHistoryItem[];
  funLeaderboard?: { rank: number; nickname: string; balance: number }[];
  limits?: { minStake: number; maxStake: number };
};

function earningReasonLabel(reason: string): string {
  switch (reason) {
    case "bet_placed":
      return "Typ na mecz";
    case "prediction_result":
      return "Trafiony typ (liga)";
    case "chat_message":
      return "Wiadomość na czacie";
    case "chat_heart":
      return "Reakcja na czat";
    case "online_session":
      return "Aktywność online";
    default:
      return reason;
  }
}

function formatKickoff(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function statusLabel(status: string) {
  if (status === "WON") return "Trafiony";
  if (status === "LOST") return "Nietrafiony";
  if (status === "PENDING") return "Oczekuje";
  return status;
}

function OddsSourceBadge() {
  return (
    <span className="text-[10px] text-white/45" title="Na podstawie rankingu siły reprezentacji (model Elo)">
      kursy wg siły drużyn
    </span>
  );
}

export default function SimulatorPage() {
  const [state, setState] = useState<SimulatorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [error, setError] = useState("");
  const [stakes, setStakes] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState<string | null>(null);

  const termsAccepted = state?.hasAcceptedSimulatorTerms ?? false;

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await api<SimulatorState>("/simulator");
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wczytać modułu aktywności");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function acceptTerms() {
    setAcceptingTerms(true);
    setError("");
    try {
      const data = await api<SimulatorState>("/simulator/accept-terms", { method: "POST" });
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać akceptacji regulaminu");
    } finally {
      setAcceptingTerms(false);
    }
  }

  async function placeBet(matchId: string, selection: VirtualBetSelection) {
    const stake = stakes[matchId] ?? state?.limits?.minStake ?? 10;
    setPlacing(`${matchId}-${selection}`);
    setError("");
    try {
      const data = await api<SimulatorState>("/simulator/bets", {
        method: "POST",
        body: JSON.stringify({ matchId, selection, stake }),
      });
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać typu bonusowego");
    } finally {
      setPlacing(null);
    }
  }

  if (loading || !state) {
    return <LoadingScreen label="Wczytywanie gry towarzyskiej…" />;
  }

  if (!termsAccepted) {
    return (
      <>
        <div className="flex min-h-[50vh] items-center justify-center opacity-30">
          <Gamepad2 className="h-16 w-16 text-[var(--wc-gold)]" />
        </div>
        {error && (
          <p className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <SimulatorTermsModal accepting={acceptingTerms} onAccept={() => void acceptTerms()} />
      </>
    );
  }

  const {
    disclaimer,
    wallet,
    earningRules,
    recentEarnings,
    bettableMatches,
    betHistory,
    funLeaderboard,
    limits,
  } = state as Required<
    Pick<
      SimulatorState,
      | "disclaimer"
      | "wallet"
      | "earningRules"
      | "recentEarnings"
      | "bettableMatches"
      | "betHistory"
      | "funLeaderboard"
      | "limits"
    >
  > & { hasAcceptedSimulatorTerms: true };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="wc-page-title flex items-center gap-2">
            <Gamepad2 className="h-8 w-8 text-[var(--wc-gold)]" />
            Gra towarzyska
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Punkty aktywności · nie liczą się do rankingu ligowego ·{" "}
            <Link to="/symulator/regulamin" className="text-[var(--wc-gold)]/80 hover:underline">
              regulamin
            </Link>
          </p>
        </div>
        <RefreshButton onClick={() => void load(true)} loading={refreshing} />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[var(--wc-gold)]/20 bg-[var(--wc-gold)]/5 p-4 text-sm text-white/70">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wc-gold)]" />
        <p>{disclaimer}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-pitch p-5">
          <p className="mb-3 text-xs uppercase tracking-wide text-white/45">Jak zdobywać punkty</p>
          <ul className="space-y-2 text-sm text-white/70">
            {earningRules.map((rule) => (
              <li key={rule.id} className="flex items-start justify-between gap-3">
                <span>
                  {rule.label}
                  <span className="mt-0.5 block text-xs text-white/35">{rule.note}</span>
                </span>
                <span className="shrink-0 font-mono font-semibold text-[var(--wc-gold)]">
                  +{rule.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-pitch p-5">
          <p className="mb-3 text-xs uppercase tracking-wide text-white/45">Ostatnie nagrody</p>
          {recentEarnings.length === 0 ? (
            <p className="text-sm text-white/40">
              Typuj mecze, pisz na czacie i bądź aktywny — punkty pojawią się tutaj.
            </p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
              {recentEarnings.map((entry, i) => (
                <li
                  key={`${entry.createdAt}-${i}`}
                  className="flex items-center justify-between gap-2 text-white/65"
                >
                  <span>{earningReasonLabel(entry.reason)}</span>
                  <span className="font-mono text-emerald-400/90">+{entry.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card-pitch flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wc-gold)]/15">
            <Coins className="h-6 w-6 text-[var(--wc-gold)]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/45">Twoje saldo</p>
            <p className="font-display text-3xl font-bold text-[var(--wc-gold)]">
              {formatActivityPoints(wallet.balance)} pkt aktywności
            </p>
          </div>
        </div>

        <div className="card-pitch p-5">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-white/45">
            <Trophy className="h-3.5 w-3.5" />
            Ranking aktywności
          </p>
          <ul className="space-y-1 text-sm">
            {funLeaderboard.length === 0 ? (
              <li className="text-white/40">Brak graczy z punktami</li>
            ) : (
              funLeaderboard.map((row) => (
                <li key={row.rank} className="flex justify-between text-white/70">
                  <span>
                    <span className="mr-2 font-mono text-white/35">{row.rank}.</span>
                    {row.nickname}
                  </span>
                  <span className="font-mono text-[var(--wc-gold)]/90">
                    {formatActivityPoints(row.balance)} pkt
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl text-white">Typy bonusowe 1X2</h2>
        {bettableMatches.length === 0 ? (
          <p className="text-sm text-white/45">Brak meczów do typowania.</p>
        ) : (
          <ul className="space-y-3">
            {bettableMatches.map((match) => {
              const stake = stakes[match.id] ?? limits.minStake;
              const hasBet = Boolean(match.userBet);
              return (
                <li key={match.id} className="card-pitch p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                    <span>
                      {match.fixtureNumber ? `M${match.fixtureNumber}` : "Mecz"}
                      {match.stage && ` · ${match.stage}`}
                    </span>
                    <span>{formatKickoff(match.kickoffTime)}</span>
                  </div>

                  <div className="mb-4 flex items-center justify-center gap-4">
                    <TeamWithFlag name={match.homeTeam} flagWidth={28} />
                    <span className="text-white/30">vs</span>
                    <TeamWithFlag name={match.awayTeam} flagWidth={28} />
                  </div>

                  {!match.odds ? (
                    <p className="text-center text-sm text-white/40">Ładowanie mnożników…</p>
                  ) : hasBet && match.userBet ? (
                    <div className="rounded-lg bg-white/5 px-3 py-2 text-center text-sm text-white/70">
                      Twój typ:{" "}
                      <span className="text-[var(--wc-gold)]">
                        {selectionLabel(match.userBet.selection, match.homeTeam, match.awayTeam)}
                      </span>
                      {" · "}
                      {formatActivityPoints(match.userBet.stake)} pkt · mnożnik{" "}
                      {formatOddsDecimal(match.userBet.odds)} · możliwy zysk{" "}
                      {formatActivityPoints(potentialPayout(match.userBet.stake, match.userBet.odds))} pkt
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex justify-center">
                        <OddsSourceBadge />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["HOME", match.odds.home],
                            ["DRAW", match.odds.draw],
                            ["AWAY", match.odds.away],
                          ] as const
                        ).map(([selection, oddsValue]) => (
                          <button
                            key={selection}
                            type="button"
                            disabled={placing !== null || wallet.balance < stake}
                            onClick={() => void placeBet(match.id, selection)}
                            className="rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center transition hover:border-[var(--wc-gold)]/40 hover:bg-[var(--wc-gold)]/10 disabled:opacity-50"
                          >
                            <p className="text-[10px] uppercase text-white/45">
                              {selection === "HOME" ? "1" : selection === "DRAW" ? "X" : "2"}
                            </p>
                            <p className="font-mono text-lg font-bold text-[var(--wc-gold)]">
                              {formatOddsDecimal(oddsValue)}
                            </p>
                            <p className="mt-1 text-[10px] text-white/40">
                              +{formatActivityPoints(potentialPayout(stake, oddsValue))} pkt
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <label className="text-xs text-white/45">Punkty:</label>
                        <input
                          type="number"
                          min={limits.minStake}
                          max={Math.min(limits.maxStake, wallet.balance)}
                          value={stake}
                          onChange={(e) =>
                            setStakes((prev) => ({
                              ...prev,
                              [match.id]: Number(e.target.value) || limits.minStake,
                            }))
                          }
                          className="input-score w-20 text-center text-sm"
                        />
                        <span className="text-xs text-white/35">pkt aktywności</span>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {betHistory.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl text-white">Twoja historia</h2>
          <ul className="space-y-2">
            {betHistory.map((bet) => (
              <li
                key={bet.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <div className="text-white/70">
                  <TeamWithFlag name={bet.homeTeam} flagWidth={16} />
                  <span className="mx-1 text-white/30">vs</span>
                  <TeamWithFlag name={bet.awayTeam} flagWidth={16} />
                  <span className="ml-2 text-white/40">{formatKickoff(bet.kickoffTime)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-white/55">
                  <span>
                    {selectionLabel(bet.selection, bet.homeTeam, bet.awayTeam)} ·{" "}
                    {formatActivityPoints(bet.stake)} pkt @ {formatOddsDecimal(bet.odds)}
                  </span>
                  <span
                    className={
                      bet.status === "WON"
                        ? "text-emerald-400"
                        : bet.status === "LOST"
                          ? "text-red-400/80"
                          : "text-amber-300/80"
                    }
                  >
                    {statusLabel(bet.status)}
                    {bet.status === "WON" && bet.payout != null && (
                      <> (+{formatActivityPoints(bet.payout)} pkt)</>
                    )}
                  </span>
                  {bet.homeScore != null && bet.awayScore != null && (
                    <span className="font-mono text-white/40">
                      {bet.homeScore}:{bet.awayScore}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
