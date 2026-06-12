import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Lock, Medal, Search } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { getDisplayName, getInitials, orderUsersForTipsTable } from "@shared/display-names";
import { isKnockoutStage } from "@shared/knockout";
import { formatPoints, getPointsToneClass, isMatchLocked } from "@shared/scoring";
import { formatLastActive } from "@shared/relative-time";
import { RANKING_TOP_N } from "@shared/league-limits";
import { countOnlineUsers, formatOnlineCount } from "@shared/online-presence";
import { hasMatchesNeedingLivePoll, LIVE_UI_POLL_MS } from "@shared/live-sync";
import { abbreviateTeam } from "@shared/team-abbrev";
import { LeaderGapBanner } from "../components/LeaderGapBanner";
import { PlayerStatsPanel } from "../components/PlayerStatsPanel";
import { TournamentStatusInfo, type TournamentProgress } from "../components/TournamentStatusInfo";
import type { LastResultUpdate } from "../components/LastResultUpdateInfo";
import { LoadingScreen } from "../components/LoadingScreen";
import { RefreshButton } from "../components/RefreshButton";
import { TeamWithFlag } from "../components/TeamWithFlag";

type LeaderboardUser = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  totalPoints: number;
  lastActiveAt: string;
};

type LeaderboardMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  kickoffTime: string;
  stage: string | null;
  knockoutWinner: string | null;
};

type Prediction = {
  userId: string;
  matchId: string;
  concealed?: true;
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  predictedKnockoutWinner?: string | null;
  pointsEarned?: number | null;
};

type RankKolejkaDelta = {
  kolejkaKey: string | null;
  kolejkaLabel: string | null;
  deltas: Record<string, number | null>;
};

type LeaderboardData = {
  users: LeaderboardUser[];
  playerCount: number;
  onlineCount?: number;
  onlineThresholdMinutes?: number;
  lastResultUpdate: LastResultUpdate | null;
  tournamentProgress: TournamentProgress | null;
  rankKolejkaDelta?: RankKolejkaDelta;
};

type TipsData = {
  matches: LeaderboardMatch[];
  predictions: Prediction[];
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function ConcealedPrediction() {
  return (
    <span
      className="inline-flex items-center justify-center text-white/25"
      title="Typ ukryty do rozpoczęcia meczu"
    >
      <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
    </span>
  );
}

function PredictionCell({
  prediction,
  finished,
  live = false,
  concealed = false,
}: {
  prediction?: Prediction;
  finished: boolean;
  live?: boolean;
  concealed?: boolean;
}) {
  if (!prediction) {
    return <span className="text-[10px] text-white/25 sm:text-sm">—</span>;
  }

  if (prediction.concealed || (concealed && !finished)) {
    return <ConcealedPrediction />;
  }

  const score = `${prediction.predictedHomeScore}:${prediction.predictedAwayScore}`;

  if ((finished || live) && prediction.pointsEarned != null) {
    const pts = prediction.pointsEarned;

    return (
      <div className="flex flex-col items-center gap-0 leading-none sm:gap-0.5">
        <span className="text-[10px] font-bold sm:text-sm">{score}</span>
        <span
          className={`text-[9px] font-semibold sm:text-xs sm:font-medium ${getPointsToneClass(pts)} ${
            live ? "animate-pulse" : ""
          }`}
          title={live ? "Punkty na żywo — mogą się zmienić" : undefined}
        >
          +{formatPoints(pts)}
        </span>
      </div>
    );
  }

  return <span className="text-[10px] font-bold sm:text-sm">{score}</span>;
}

type RankedUser = { user: LeaderboardUser; rank: number };

function RankProgressBadge({ change }: { change: number | null | undefined }) {
  if (change == null || change === 0) {
    return <span className="font-mono text-sm text-white/30">—</span>;
  }
  if (change > 0) {
    return (
      <span className="font-mono text-sm font-semibold text-green-400" title="Awans w rankingu">
        +{change}
      </span>
    );
  }
  return (
    <span className="font-mono text-sm font-semibold text-red-400" title="Spadek w rankingu">
      {change}
    </span>
  );
}

function RankingRow({
  entry,
  isMe,
  rankChange,
  showRankProgress = false,
}: {
  entry: RankedUser;
  isMe: boolean;
  rankChange?: number | null;
  showRankProgress?: boolean;
}) {
  const { user: u, rank } = entry;

  return (
    <tr className={`border-b border-white/5 ${isMe ? "bg-[var(--gold)]/10" : ""}`}>
      <td className="px-4 py-3 font-mono text-white/60">
        <span className="flex items-center gap-1">
          {rank <= 3 && (
            <Medal
              className={`h-4 w-4 ${
                rank === 1
                  ? "text-yellow-400"
                  : rank === 2
                    ? "text-gray-300"
                    : "text-amber-600"
              }`}
            />
          )}
          {rank}
        </span>
      </td>
      <td className="px-2 py-3 text-center">
        {showRankProgress ? <RankProgressBadge change={rankChange ?? null} /> : null}
      </td>
      <td className="px-4 py-3 font-medium">
        {getDisplayName(u)}
        {isMe && <span className="ml-2 text-xs text-[var(--gold)]">(Ty)</span>}
      </td>
      <td className="px-4 py-3 text-right text-xl font-bold text-[var(--gold)]">
        {u.totalPoints}
      </td>
    </tr>
  );
}

function MatchResultBadge({
  finished,
  live = false,
  homeScore,
  awayScore,
  compact,
}: {
  finished: boolean;
  live?: boolean;
  homeScore: number | null;
  awayScore: number | null;
  compact?: boolean;
}) {
  const showScore = (finished || live) && homeScore != null && awayScore != null;

  if (!showScore) {
    return (
      <span className={`text-white/30 ${compact ? "text-xs sm:text-sm" : "text-xs"}`}>—</span>
    );
  }

  return (
    <span
      className={`inline-block rounded-md font-bold ${
        live
          ? "bg-red-500/15 text-red-300"
          : "bg-[var(--gold)]/15 text-[var(--gold)]"
      } ${compact ? "px-1.5 py-0.5 text-xs sm:text-sm" : "px-1.5 py-0.5 text-xs sm:text-sm"}`}
      title={live ? "Wynik na żywo" : undefined}
    >
      {homeScore}:{awayScore}
    </span>
  );
}

function MatchLabel({
  homeTeam,
  awayTeam,
  stage,
  kickoffTime,
  finished = false,
  live = false,
  homeScore = null,
  awayScore = null,
  compact = false,
}: {
  homeTeam: string;
  awayTeam: string;
  stage: string | null;
  kickoffTime: string;
  finished?: boolean;
  live?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  compact?: boolean;
}) {
  const shortDate = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "numeric",
  }).format(new Date(kickoffTime));

  const tooltip = `${homeTeam} – ${awayTeam}${stage ? ` · ${stage}` : ""} · ${formatDate(kickoffTime)}`;

  if (compact) {
    return (
      <div
        className="mx-auto flex w-full max-w-[7.5rem] flex-col items-center leading-snug"
        title={tooltip}
      >
        <div className="flex items-center justify-center gap-1">
          <TeamWithFlag name={homeTeam} flagWidth={18} showName={false} />
          <span className="text-xs font-bold leading-none sm:text-sm">{abbreviateTeam(homeTeam)}</span>
        </div>
        <div className="my-0.5 flex justify-center">
          <MatchResultBadge
            finished={finished}
            live={live}
            homeScore={homeScore}
            awayScore={awayScore}
            compact
          />
        </div>
        <div className="flex items-center justify-center gap-1">
          <TeamWithFlag name={awayTeam} flagWidth={18} showName={false} />
          <span className="text-xs font-bold leading-none sm:text-sm">{abbreviateTeam(awayTeam)}</span>
        </div>
        <span className="mt-0.5 text-[11px] text-white/45 sm:text-xs">{shortDate}</span>
      </div>
    );
  }

  return (
    <div title={tooltip}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium whitespace-nowrap">
        <TeamWithFlag name={homeTeam} flagWidth={18} />
        <MatchResultBadge
          finished={finished}
          live={live}
          homeScore={homeScore}
          awayScore={awayScore}
        />
        <TeamWithFlag name={awayTeam} flagWidth={18} />
      </p>
      <p className="text-xs text-white/40">
        {stage} · {formatDate(kickoffTime)}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [matches, setMatches] = useState<LeaderboardMatch[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [showMatrix, setShowMatrix] = useState(true);
  const [lastResultUpdate, setLastResultUpdate] = useState<LastResultUpdate | null>(null);
  const [tournamentProgress, setTournamentProgress] = useState<TournamentProgress | null>(null);
  const [kolejkaLabel, setKolejkaLabel] = useState<string | null>(null);
  const [topRankChanges, setTopRankChanges] = useState<Map<string, number | null>>(new Map());
  const [now, setNow] = useState(() => new Date());
  const rankDeltaFreezeRef = useRef<{
    kolejkaKey: string | null;
    lastResultAt: string | null;
  } | null>(null);

  useEffect(() => {
    const imminentKickoff = matches.some((m) => {
      if (m.status === "FINISHED") return false;
      const msToKickoff = new Date(m.kickoffTime).getTime() - Date.now();
      return msToKickoff <= 5 * 60 * 1000;
    });
    const intervalMs = imminentKickoff ? 1_000 : 30_000;
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [matches]);

  const loadRanking = useCallback(async () => {
    const result = await api<LeaderboardData>("/leaderboard");
    setUsers(result.users);
    setLastResultUpdate(result.lastResultUpdate ?? null);
    setTournamentProgress(result.tournamentProgress ?? null);

    const delta = result.rankKolejkaDelta;
    const lastResultAt = result.lastResultUpdate?.at ?? null;
    const kolejkaKey = delta?.kolejkaKey ?? null;
    const frozen = rankDeltaFreezeRef.current;

    if (
      !frozen ||
      frozen.kolejkaKey !== kolejkaKey ||
      frozen.lastResultAt !== lastResultAt
    ) {
      setTopRankChanges(new Map(Object.entries(delta?.deltas ?? {})));
      setKolejkaLabel(delta?.kolejkaLabel ?? null);
      rankDeltaFreezeRef.current = { kolejkaKey, lastResultAt };
    }

    return result;
  }, []);

  const loadTips = useCallback(async () => {
    setTipsLoading(true);
    try {
      const result = await api<TipsData>("/leaderboard/tips");
      setMatches(result.matches);
      setPredictions(result.predictions);
    } finally {
      setTipsLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        await loadRanking();
        void loadTips();
      } catch {
        if (!silent) {
          setUsers([]);
          setMatches([]);
          setPredictions([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadRanking, loadTips]
  );

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!hasMatchesNeedingLivePoll(matches)) return;
    const id = setInterval(() => void loadLeaderboard(true), LIVE_UI_POLL_MS);
    return () => clearInterval(id);
  }, [matches, loadLeaderboard]);

  const predictionMap = useMemo(() => {
    const map = new Map<string, Prediction>();
    predictions.forEach((p) => map.set(`${p.userId}:${p.matchId}`, p));
    return map;
  }, [predictions]);

  const tipUsers = useMemo(() => orderUsersForTipsTable(users), [users]);

  const filteredTipUsers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return tipUsers;
    return tipUsers.filter((u) => {
      const name = getDisplayName(u).toLowerCase();
      return name.includes(q) || u.nickname.includes(q);
    });
  }, [tipUsers, playerSearch]);

  const matrixEnabled = showMatrix && users.length > 0;

  const onlineCount = useMemo(
    () => (users.length > 0 ? countOnlineUsers(users, now) : 0),
    [users, now],
  );

  const rankingDisplay = useMemo(() => {
    const ranked: RankedUser[] = users.map((u, index) => ({ user: u, rank: index + 1 }));
    const top = ranked.slice(0, RANKING_TOP_N);
    const myEntry = user ? ranked.find((r) => r.user.id === user.id) : undefined;
    const meBelowTop =
      myEntry && myEntry.rank > RANKING_TOP_N ? myEntry : undefined;
    const matrixColumns = meBelowTop ? [...top, meBelowTop] : top;

    return { top, meBelowTop, matrixColumns };
  }, [users, user?.id]);

  if (loading) {
    return <LoadingScreen label="Ładowanie rankingu…" compact />;
  }

  if (!loading && users.length === 0) {
    return <p className="text-white/60">Nie udało się załadować rankingu.</p>;
  }

  return (
    <div className="space-y-8">
      {!user && (
        <div className="card-pitch flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <p className="text-white/70">
            Podgląd rankingu bez logowania — typy na mecze jeszcze się nie rozpoczęte są ukryte.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/login" className="btn-ghost text-sm">
              Zaloguj się
            </Link>
            <Link to="/register" className="btn-ghost text-sm border-[var(--wc-gold)]/40 text-[var(--wc-gold)]">
              Dołącz do ligi
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="wc-page-title">Ranking</h2>
          <p className="text-white/60">
            {users.length} graczy · top {RANKING_TOP_N}
            {rankingDisplay.meBelowTop ? " + Twoja pozycja" : ""}
            {kolejkaLabel && (
              <>
                {" "}
                · Δ top {RANKING_TOP_N} od startu kolejki ({kolejkaLabel})
              </>
            )}
          </p>
        </div>
        <RefreshButton loading={refreshing} onClick={() => loadLeaderboard(true)} />
      </div>

      <TournamentStatusInfo
        lastResultUpdate={lastResultUpdate}
        tournamentProgress={tournamentProgress}
      />

      <LeaderGapBanner users={users} currentUserId={user?.id} />

      {/* Tabela punktów */}
      <div className="card-pitch overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-white/10 bg-white/5 text-sm uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3">#</th>
              <th
                className="w-12 px-2 py-3 text-center"
                title="Ilu graczy z poprzedniej top 10 wyprzedzono od startu kolejki (po zakończeniu meczu)"
              >
                Δ
              </th>
              <th className="px-4 py-3">Gracz</th>
              <th className="px-4 py-3 text-right">Punkty</th>
            </tr>
          </thead>
          <tbody>
            {rankingDisplay.top.map((entry) => (
              <RankingRow
                key={entry.user.id}
                entry={entry}
                isMe={entry.user.id === user?.id}
                showRankProgress
                rankChange={topRankChanges.get(entry.user.id) ?? null}
              />
            ))}
            {rankingDisplay.meBelowTop && (
              <>
                <tr className="border-b border-white/5">
                  <td colSpan={4} className="px-4 py-2 text-center text-sm text-white/30">
                    …
                  </td>
                </tr>
                <RankingRow
                  entry={rankingDisplay.meBelowTop}
                  isMe
                  showRankProgress
                  rankChange={topRankChanges.get(rankingDisplay.meBelowTop.user.id) ?? null}
                />
              </>
            )}
          </tbody>
        </table>
      </div>

      {users.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-white/50">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span>
            {formatOnlineCount(onlineCount)}
            <span className="text-white/35"> · aktywni w ostatnich 5 min</span>
          </span>
        </p>
      )}

      {/* Macierz typów — top 10 + Ty (jeśli poza top 10) */}
      {users.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--gold)]">Tabela typów</h3>
            <button
              type="button"
              onClick={() => setShowMatrix((open) => !open)}
              className="btn-ghost text-sm"
              aria-expanded={matrixEnabled}
            >
              {matrixEnabled ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Zwiń tabelę
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Rozwiń tabelę
                </>
              )}
            </button>
          </div>

          {!matrixEnabled && (
            <p className="text-sm text-white/45">
              Top {RANKING_TOP_N}
              {rankingDisplay.meBelowTop ? " + Twoja kolumna" : user ? " (jesteś w top 10)" : ""} —
              rozwiń, aby zobaczyć macierz typów.
            </p>
          )}

          {matrixEnabled ? (
            <>
              <p className="text-sm text-white/50">
                Kolumny: top {RANKING_TOP_N}
                {rankingDisplay.meBelowTop ? " + Ty" : ""}. Typy innych graczy są ukryte do
                rozpoczęcia meczu; po starcie widać obstawienia i punkty.
              </p>
              <p className="text-xs text-white/40 sm:hidden">
                Przesuń tabelę w bok, aby zobaczyć wszystkie kolumny →
              </p>
              {tipsLoading || matches.length === 0 ? (
                <p className="text-sm text-white/40">Ładowanie typów…</p>
              ) : (
                <div className="card-pitch max-h-[min(28rem,55vh)] overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[7.5rem]" />
                      {rankingDisplay.matrixColumns.map(({ user: u }) => (
                        <col key={u.id} className="w-10" />
                      ))}
                    </colgroup>
                    <thead className="border-b border-white/10 bg-white/5 text-white/50">
                      <tr>
                        <th className="sticky left-0 z-10 bg-[#0d111c] px-1 py-2 text-center text-sm uppercase">
                          Mecz
                        </th>
                        {rankingDisplay.matrixColumns.map(({ user: u, rank }) => {
                          const isMe = u.id === user?.id;
                          return (
                            <th
                              key={u.id}
                              title={isMe ? `${getDisplayName(u)} (Ty)` : getDisplayName(u)}
                              className={`px-0.5 py-2 text-center text-[9px] font-medium leading-tight sm:text-[10px] ${
                                isMe ? "text-[var(--gold)]" : ""
                              }`}
                            >
                              <span className="block font-mono text-white/40">{rank}</span>
                              <span className="block font-semibold">{getInitials(u)}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => {
                        const finished = match.status === "FINISHED";
                        const live = match.status === "LIVE";
                        const locked = isMatchLocked(new Date(match.kickoffTime), now);
                        return (
                          <tr key={match.id} className="border-b border-white/5">
                            <td className="sticky left-0 z-10 bg-[#0d111c]/95 px-1 py-2">
                              <MatchLabel
                                homeTeam={match.homeTeam}
                                awayTeam={match.awayTeam}
                                stage={match.stage}
                                kickoffTime={match.kickoffTime}
                                finished={finished}
                                live={live}
                                homeScore={match.homeScore}
                                awayScore={match.awayScore}
                                compact
                              />
                            </td>
                            {rankingDisplay.matrixColumns.map(({ user: u }) => (
                              <td
                                key={u.id}
                                className={`px-0.5 py-1.5 text-center ${u.id === user?.id ? "bg-[var(--gold)]/5" : ""}`}
                              >
                                <PredictionCell
                                  prediction={predictionMap.get(`${u.id}:${match.id}`)}
                                  finished={finished}
                                  live={live}
                                  concealed={u.id !== user?.id && !locked}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </section>
      )}

      {/* Szczegóły per gracz */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--gold)]">Typy graczy</h3>
          {users.length > 10 && (
            <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Szukaj gracza…"
                className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--wc-gold)]"
              />
            </label>
          )}
        </div>
        {tipsLoading && matches.length === 0 ? (
          <p className="text-sm text-white/40">Ładowanie typów…</p>
        ) : (
        <div className="space-y-2">
          {filteredTipUsers.map((u) => {
            const userPredictions = matches
              .map((m) => ({
                match: m,
                prediction: predictionMap.get(`${u.id}:${m.id}`),
              }))
              .filter((entry) => entry.prediction);

            const isExpanded = expandedUser === u.id;
            const isMe = u.id === user?.id;

            return (
              <div key={u.id} className="card-pitch overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
                >
                  <span className="font-medium">
                    {getDisplayName(u)}
                    {isMe && <span className="ml-2 text-xs text-[var(--gold)]">(Ty)</span>}
                    <span className="ml-3 text-sm text-white/40">
                      {userPredictions.length} typów · {formatPoints(u.totalPoints)} pkt · aktywny{" "}
                      {formatLastActive(u.lastActiveAt)}
                    </span>
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-white/50" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/50" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-white/10 px-4 py-3">
                    <PlayerStatsPanel
                      userId={u.id}
                      predictions={predictions}
                      matches={matches}
                    />
                    {userPredictions.length === 0 ? (
                      <p className="text-sm text-white/40">Brak typów</p>
                    ) : (
                      <ul className="space-y-2">
                        {userPredictions.map(({ match, prediction }) => {
                          const finished = match.status === "FINISHED";
                          const live = match.status === "LIVE";
                          const locked = isMatchLocked(new Date(match.kickoffTime), now);
                          return (
                            <li
                              key={match.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                            >
                              <div>
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                                  <TeamWithFlag name={match.homeTeam} flagWidth={16} />
                                  <span className="text-white/40">vs</span>
                                  <TeamWithFlag name={match.awayTeam} flagWidth={16} />
                                </span>
                                <span className="ml-0 mt-1 block text-white/40">{match.stage}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {prediction!.concealed || (!finished && !isMe && !locked) ? (
                                  <span className="inline-flex items-center gap-1.5 text-white/40">
                                    <Lock className="h-3.5 w-3.5" />
                                    Ukryty do rozpoczęcia meczu
                                  </span>
                                ) : (
                                  <span className="font-bold">
                                    Typ: {prediction!.predictedHomeScore}:
                                    {prediction!.predictedAwayScore}
                                    {isKnockoutStage(match.stage) &&
                                      prediction!.predictedKnockoutWinner && (
                                        <span className="ml-1 text-sm font-medium text-white/55">
                                          → awans:{" "}
                                          {prediction!.predictedKnockoutWinner === "HOME"
                                            ? match.homeTeam
                                            : match.awayTeam}
                                        </span>
                                      )}
                                  </span>
                                )}
                                {(finished || live) && match.homeScore != null && match.awayScore != null && (
                                  <>
                                    <span className={live ? "text-red-300/80" : "text-white/40"}>
                                      {live ? "Na żywo" : "Wynik"}: {match.homeScore}:{match.awayScore}
                                    </span>
                                    {(finished || live) && prediction!.pointsEarned != null && (
                                      <span
                                        className={`font-semibold ${getPointsToneClass(prediction!.pointsEarned!)} ${
                                          live ? "animate-pulse" : ""
                                        }`}
                                        title={live ? "Punkty na żywo — mogą się zmienić" : undefined}
                                      >
                                        +{formatPoints(prediction!.pointsEarned!)} pkt
                                        {live ? " (live)" : ""}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredTipUsers.length === 0 && (
            <p className="text-sm text-white/40">Brak graczy pasujących do wyszukiwania.</p>
          )}
        </div>
        )}
      </section>

      <div className="card-pitch p-4 text-sm text-white/60">
        <p>
          Pełne zasady punktacji, typowania i rankingu znajdziesz w zakładce{" "}
          <Link to="/rules" className="font-medium text-[var(--wc-gold)] hover:underline">
            Zasady
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
