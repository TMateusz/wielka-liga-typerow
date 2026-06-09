import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Lock, Medal, Search } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { getDisplayName, getShortName, orderUsersForTipsTable } from "@shared/display-names";
import { isDrawScore, isKnockoutStage } from "@shared/knockout";
import { formatPoints, SCORING } from "@shared/scoring";
import { formatLastActive } from "@shared/relative-time";
import { RANKING_TOP_N, TIPS_MATRIX_USER_LIMIT } from "@shared/league-limits";
import { abbreviateTeam } from "@shared/team-abbrev";
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
};

type Prediction = {
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  predictedKnockoutWinner: string | null;
  pointsEarned: number | null;
};

type LeaderboardData = {
  users: LeaderboardUser[];
  playerCount: number;
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
      title="Typ ukryty do zakończenia meczu"
    >
      <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
    </span>
  );
}

function PredictionCell({
  prediction,
  finished,
  concealed = false,
}: {
  prediction?: Prediction;
  finished: boolean;
  concealed?: boolean;
}) {
  if (!prediction) {
    return <span className="text-[10px] text-white/25 sm:text-sm">—</span>;
  }

  if (concealed && !finished) {
    return <ConcealedPrediction />;
  }

  const score = `${prediction.predictedHomeScore}:${prediction.predictedAwayScore}`;

  if (finished && prediction.pointsEarned != null) {
    const pts = prediction.pointsEarned;
    const color =
      pts === SCORING.EXACT
        ? "text-green-400"
        : pts === SCORING.KNOCKOUT_DRAW_WINNER
          ? "text-sky-400"
          : pts === SCORING.OUTCOME
            ? "text-yellow-400"
            : pts === SCORING.KNOCKOUT_WINNER_AFTER_REG_DRAW
              ? "text-orange-400"
              : "text-red-400";

    return (
      <div className="flex flex-col items-center gap-0 leading-none sm:gap-0.5">
        <span className="text-[10px] font-bold sm:text-sm">{score}</span>
        <span className={`text-[9px] font-semibold sm:text-xs sm:font-medium ${color}`}>
          +{formatPoints(pts)}
        </span>
      </div>
    );
  }

  return <span className="text-[10px] font-bold sm:text-sm">{score}</span>;
}

type RankedUser = { user: LeaderboardUser; rank: number };

function RankingRow({
  entry,
  isMe,
}: {
  entry: RankedUser;
  isMe: boolean;
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
  homeScore,
  awayScore,
  compact,
}: {
  finished: boolean;
  homeScore: number | null;
  awayScore: number | null;
  compact?: boolean;
}) {
  if (!finished || homeScore == null || awayScore == null) {
    return (
      <span className={`text-white/30 ${compact ? "text-[9px]" : "text-xs"}`}>—</span>
    );
  }

  return (
    <span
      className={`inline-block rounded-md bg-[var(--gold)]/15 font-bold text-[var(--gold)] ${
        compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-xs sm:text-sm"
      }`}
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
  homeScore = null,
  awayScore = null,
  compact = false,
}: {
  homeTeam: string;
  awayTeam: string;
  stage: string | null;
  kickoffTime: string;
  finished?: boolean;
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
        className="mx-auto flex w-full max-w-[4.5rem] flex-col items-center leading-tight"
        title={tooltip}
      >
        <div className="flex items-center justify-center gap-0.5">
          <TeamWithFlag name={homeTeam} flagWidth={13} showName={false} />
          <span className="text-[9px] font-bold leading-none">{abbreviateTeam(homeTeam)}</span>
        </div>
        <div className="my-0.5 flex justify-center">
          <MatchResultBadge
            finished={finished}
            homeScore={homeScore}
            awayScore={awayScore}
            compact
          />
        </div>
        <div className="flex items-center justify-center gap-0.5">
          <TeamWithFlag name={awayTeam} flagWidth={13} showName={false} />
          <span className="text-[9px] font-bold leading-none">{abbreviateTeam(awayTeam)}</span>
        </div>
        <span className="mt-0.5 text-[8px] text-white/35">{shortDate}</span>
      </div>
    );
  }

  return (
    <div title={tooltip}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium whitespace-nowrap">
        <TeamWithFlag name={homeTeam} flagWidth={18} />
        <MatchResultBadge finished={finished} homeScore={homeScore} awayScore={awayScore} />
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
  const [showMatrix, setShowMatrix] = useState(false);

  const loadRanking = useCallback(async () => {
    const result = await api<LeaderboardData>("/leaderboard");
    setUsers(result.users);
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
        const ranking = await loadRanking();
        void loadTips();
        if (ranking.playerCount <= TIPS_MATRIX_USER_LIMIT) {
          setShowMatrix(true);
        }
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

  const matrixEnabled =
    showMatrix && users.length > 0 && users.length <= TIPS_MATRIX_USER_LIMIT;
  const matrixAvailable = users.length <= TIPS_MATRIX_USER_LIMIT;

  const rankingDisplay = useMemo(() => {
    const ranked: RankedUser[] = users.map((u, index) => ({ user: u, rank: index + 1 }));
    const top = ranked.slice(0, RANKING_TOP_N);
    const myEntry = user ? ranked.find((r) => r.user.id === user.id) : undefined;
    const meBelowTop =
      myEntry && myEntry.rank > RANKING_TOP_N ? myEntry : undefined;

    return { top, meBelowTop };
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
            Podgląd rankingu bez logowania — typy na nadchodzące mecze są ukryte.
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
          </p>
        </div>
        <RefreshButton loading={refreshing} onClick={() => loadLeaderboard(true)} />
      </div>

      {/* Tabela punktów */}
      <div className="card-pitch overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-white/10 bg-white/5 text-sm uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3">#</th>
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
              />
            ))}
            {rankingDisplay.meBelowTop && (
              <>
                <tr className="border-b border-white/5">
                  <td colSpan={3} className="px-4 py-2 text-center text-sm text-white/30">
                    …
                  </td>
                </tr>
                <RankingRow entry={rankingDisplay.meBelowTop} isMe />
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Macierz typów — tylko przy mniejszej liczbie graczy */}
      {matches.length > 0 && matrixAvailable && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--gold)]">Tabela typów</h3>
            {!matrixEnabled && (
              <button
                type="button"
                onClick={() => setShowMatrix(true)}
                className="btn-ghost text-sm"
              >
                Pokaż macierz
              </button>
            )}
          </div>

          {matrixEnabled ? (
            <>
              <p className="text-sm text-white/50">
                Typy innych graczy na nadchodzące mecze są ukryte. Po zakończeniu meczu widać
                wynik i punkty (+3 / +1 / +0).
              </p>
              <p className="text-xs text-white/40 sm:hidden">
                Przesuń tabelę w bok, aby zobaczyć wszystkich graczy →
              </p>
              {tipsLoading ? (
                <p className="text-sm text-white/40">Ładowanie typów…</p>
              ) : (
                <div className="card-pitch overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[4.5rem]" />
                      {tipUsers.map((u) => (
                        <col key={u.id} className="w-10" />
                      ))}
                    </colgroup>
                    <thead className="border-b border-white/10 bg-white/5 text-white/50">
                      <tr>
                        <th className="sticky left-0 z-10 bg-[#0d111c] px-0.5 py-2 text-center text-[9px] uppercase">
                          Mecz
                        </th>
                        {tipUsers.map((u) => (
                          <th
                            key={u.id}
                            className="px-0.5 py-2 text-center text-[9px] font-medium sm:text-[10px] sm:whitespace-nowrap"
                          >
                            <span className="sm:hidden">{getShortName(u).slice(0, 4)}</span>
                            <span className="hidden sm:inline">{getShortName(u)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => {
                        const finished = match.status === "FINISHED";
                        return (
                          <tr key={match.id} className="border-b border-white/5">
                            <td className="sticky left-0 z-10 bg-[#0d111c]/95 px-0.5 py-1.5">
                              <MatchLabel
                                homeTeam={match.homeTeam}
                                awayTeam={match.awayTeam}
                                stage={match.stage}
                                kickoffTime={match.kickoffTime}
                                finished={finished}
                                homeScore={match.homeScore}
                                awayScore={match.awayScore}
                                compact
                              />
                            </td>
                            {tipUsers.map((u) => (
                              <td
                                key={u.id}
                                className="px-0.5 py-1.5 text-center"
                              >
                                <PredictionCell
                                  prediction={predictionMap.get(`${u.id}:${match.id}`)}
                                  finished={finished}
                                  concealed={u.id !== user?.id}
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
          ) : (
            <p className="text-sm text-white/40">
              Macierz ukryta — przy {users.length} graczach użyj listy „Typy graczy” poniżej.
            </p>
          )}
        </section>
      )}

      {matches.length > 0 && !matrixAvailable && (
        <div className="card-pitch p-4 text-sm text-white/50">
          Przy {users.length} graczach pełna macierz typów byłaby zbyt wolna w przeglądarce.
          Użyj wyszukiwarki i listy „Typy graczy” poniżej.
        </div>
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
                    {userPredictions.length === 0 ? (
                      <p className="text-sm text-white/40">Brak typów</p>
                    ) : (
                      <ul className="space-y-2">
                        {userPredictions.map(({ match, prediction }) => {
                          const finished = match.status === "FINISHED";
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
                                {!finished && !isMe ? (
                                  <span className="inline-flex items-center gap-1.5 text-white/40">
                                    <Lock className="h-3.5 w-3.5" />
                                    Ukryty do zakończenia
                                  </span>
                                ) : (
                                  <span className="font-bold">
                                    Typ: {prediction!.predictedHomeScore}:
                                    {prediction!.predictedAwayScore}
                                    {isKnockoutStage(match.stage) &&
                                      isDrawScore(
                                        prediction!.predictedHomeScore,
                                        prediction!.predictedAwayScore
                                      ) &&
                                      prediction!.predictedKnockoutWinner && (
                                        <span className="ml-1 text-sm font-medium text-white/55">
                                          →{" "}
                                          {prediction!.predictedKnockoutWinner === "HOME"
                                            ? match.homeTeam
                                            : match.awayTeam}
                                        </span>
                                      )}
                                  </span>
                                )}
                                {finished && (
                                  <>
                                    <span className="text-white/40">
                                      Wynik: {match.homeScore}:{match.awayScore}
                                    </span>
                                    <span
                                      className={`font-semibold ${
                                        prediction!.pointsEarned === SCORING.EXACT
                                          ? "text-green-400"
                                          : prediction!.pointsEarned === SCORING.KNOCKOUT_DRAW_WINNER
                                            ? "text-sky-400"
                                            : prediction!.pointsEarned === SCORING.OUTCOME
                                              ? "text-yellow-400"
                                              : prediction!.pointsEarned ===
                                                  SCORING.KNOCKOUT_WINNER_AFTER_REG_DRAW
                                                ? "text-orange-400"
                                                : "text-red-400"
                                      }`}
                                    >
                                      +{formatPoints(prediction!.pointsEarned!)} pkt
                                    </span>
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
        <p className="font-medium text-white/80">Zasady punktacji:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>3 punkty — dokładny wynik meczu</li>
          <li>1 punkt — poprawny wynik (zwycięzca lub remis), ale zły wynik bramkowy</li>
          <li>
            Faza pucharowa przy remisie w 90. minucie: +1 pkt za remis, +1 pkt za zwycięzcę po
            dogrywce (łącznie 2 pkt)
          </li>
          <li>
            Faza pucharowa: +0,5 pkt — trafiony zwycięzca, ale typowałeś wygraną w 90. minucie
            (a był remis i wygrana dopiero po dogrywce)
          </li>
          <li>0 punktów — błędny typ</li>
        </ul>
      </div>
    </div>
  );
}
