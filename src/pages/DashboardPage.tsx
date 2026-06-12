import { useCallback, useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import type { KnockoutSide } from "@shared/knockout";
import { api } from "../api/client";
import { filterMatchesByTab, getStageTabLabel, STAGE_TABS } from "@shared/match-stages";
import { BET_WINDOW_DAYS, sortDashboardMatches } from "@shared/scoring";
import { hasMatchesNeedingLivePoll, LIVE_UI_POLL_MS } from "@shared/live-sync";
import { TournamentStatusInfo, type TournamentProgress } from "../components/TournamentStatusInfo";
import type { LastResultUpdate } from "../components/LastResultUpdateInfo";
import { UpcomingBetsStrip } from "../components/UpcomingBetsStrip";
import { LoadingScreen } from "../components/LoadingScreen";
import { RefreshButton } from "../components/RefreshButton";
import { MatchCard, type MatchData } from "../components/MatchCard";

type MatchesResponse = {
  matches: MatchData[];
  lastResultUpdate: LastResultUpdate | null;
  tournamentProgress: TournamentProgress | null;
};

export default function DashboardPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [lastResultUpdate, setLastResultUpdate] = useState<LastResultUpdate | null>(null);
  const [tournamentProgress, setTournamentProgress] = useState<TournamentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (activeTab === "finished") return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [activeTab]);

  const loadMatches = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api<MatchesResponse>("/matches");
      setMatches(data.matches);
      setLastResultUpdate(data.lastResultUpdate ?? null);
      setTournamentProgress(data.tournamentProgress ?? null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    if (!hasMatchesNeedingLivePoll(matches)) return;
    const id = setInterval(() => void loadMatches(true), LIVE_UI_POLL_MS);
    return () => clearInterval(id);
  }, [matches, loadMatches]);

  async function savePrediction(
    matchId: string,
    home: number,
    away: number,
    predictedKnockoutWinner?: KnockoutSide | null
  ) {
    await api("/predictions", {
      method: "POST",
      body: JSON.stringify({
        matchId,
        predictedHomeScore: home,
        predictedAwayScore: away,
        predictedKnockoutWinner: predictedKnockoutWinner ?? null,
      }),
    });

    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              prediction: {
                predictedHomeScore: home,
                predictedAwayScore: away,
                predictedKnockoutWinner: predictedKnockoutWinner ?? null,
                pointsEarned: m.prediction?.pointsEarned ?? null,
              },
            }
          : m
      )
    );
  }

  const liveMatches = useMemo(
    () =>
      [...matches]
        .filter((m) => m.status === "LIVE")
        .sort(
          (a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
        ),
    [matches],
  );

  const filtered = useMemo(() => {
    const list = filterMatchesByTab(matches, activeTab);
    const sorted = sortDashboardMatches(list, {
      finishedTab: activeTab === "finished",
      now,
    });
    if (activeTab === "finished") return sorted;
    return sorted.filter((m) => m.status !== "LIVE");
  }, [matches, activeTab, now]);

  if (loading) {
    return <LoadingScreen label="Ładowanie meczów…" compact />;
  }

  if (matches.length === 0) {
    return (
      <div className="card-pitch p-8 text-center text-white/60">
        Brak zaplanowanych meczów. Admin może dodać mecze w panelu administracyjnym.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {liveMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-red-300">
              <Radio className="h-4 w-4 animate-pulse" />
              Live
            </span>
            <span className="text-sm text-white/45">
              {liveMatches.length === 1 ? "1 mecz trwa" : `${liveMatches.length} mecze trwają`}
            </span>
          </div>
          <div className="grid gap-4">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} onSave={savePrediction} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="wc-page-title">Mecze</h2>
          <p className="text-white/60">
            Typuj wyniki max.{" "}
            <strong className="font-medium text-white/75">{BET_WINDOW_DAYS} dni przed</strong>{" "}
            rozpoczęciem meczu. W fazie pucharowej przy remisie wskaż też zwycięzcę po dogrywce.
          </p>
        </div>
        <RefreshButton loading={refreshing} onClick={() => loadMatches(true)} />
      </div>

      <TournamentStatusInfo
        lastResultUpdate={lastResultUpdate}
        tournamentProgress={tournamentProgress}
      />

      <UpcomingBetsStrip matches={matches} />

      <div className="card-pitch p-2">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_TABS.map((tab) => {
            const count = filterMatchesByTab(matches, tab.id).length;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                title={tab.title}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition sm:px-3 sm:py-2 ${
                  active
                    ? "bg-[var(--gold)] text-[var(--pitch-dark)]"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs ${active ? "text-[var(--pitch-dark)]/70" : "text-white/40"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--gold)]">{getStageTabLabel(activeTab)}</h3>
        <p className="text-sm text-white/40">{filtered.length} meczów</p>
      </div>

      {filtered.length === 0 ? (
        <div className="card-pitch p-8 text-center text-white/50">
          {activeTab === "finished" ? "Brak zakończonych meczów." : "Brak meczów w tej fazie turnieju."}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((match) => (
            <MatchCard key={match.id} match={match} onSave={savePrediction} />
          ))}
        </div>
      )}
    </div>
  );
}
