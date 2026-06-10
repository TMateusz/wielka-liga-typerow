import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Radio,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  CALENDAR_WEEKDAYS,
  formatPolishDateLong,
  formatPolishMonthYear,
  formatPolishTime,
  getMonthGrid,
  shortVenue,
  toPolishDateKey,
} from "@shared/calendar-dates";
import { api } from "../api/client";
import { TeamWithFlag } from "../components/TeamWithFlag";
import { useAuth } from "../contexts/AuthContext";

type CalendarMatch = {
  id: string;
  fixtureNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: string;
  stage: string | null;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

type CalendarResponse = {
  matches: CalendarMatch[];
};

const TOURNAMENT_START = { year: 2026, month: 5 };
const TOURNAMENT_END = { year: 2026, month: 6 };

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function clampMonth(year: number, month: number): { year: number; month: number } {
  const idx = monthIndex(year, month);
  const min = monthIndex(TOURNAMENT_START.year, TOURNAMENT_START.month);
  const max = monthIndex(TOURNAMENT_END.year, TOURNAMENT_END.month);
  const clamped = Math.min(max, Math.max(min, idx));
  return { year: Math.floor(clamped / 12), month: clamped % 12 };
}

function getInitialMonth(matches: CalendarMatch[]): { year: number; month: number } {
  const todayKey = toPolishDateKey(new Date());
  const hasToday = matches.some((m) => toPolishDateKey(m.kickoffTime) === todayKey);
  if (hasToday) {
    const [y, m] = todayKey.split("-").map(Number);
    return clampMonth(y, m - 1);
  }

  const upcoming = matches.find((m) => m.status === "PENDING" && new Date(m.kickoffTime) >= new Date());
  if (upcoming) {
    const key = toPolishDateKey(upcoming.kickoffTime);
    const [y, m] = key.split("-").map(Number);
    return clampMonth(y, m - 1);
  }

  return TOURNAMENT_START;
}

function stageAccent(stage: string | null): string {
  if (!stage) return "from-white/10 to-white/5";
  if (stage.includes("finał") || stage.includes("Finał")) {
    return "from-[var(--wc-gold)]/25 to-[var(--wc-gold)]/5";
  }
  if (stage.startsWith("1/") || stage.includes("półfinał") || stage.includes("Półfinał")) {
    return "from-[var(--wc-magenta)]/20 to-[var(--wc-teal)]/10";
  }
  return "from-[var(--wc-usa)]/15 to-[var(--wc-canada)]/10";
}

function MatchTimelineCard({ match }: { match: CalendarMatch }) {
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const city = shortVenue(match.venue);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${stageAccent(match.stage)} p-4 shadow-lg transition hover:border-[var(--wc-gold)]/30`}
    >
      {live && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">
          <Radio className="h-3 w-3 animate-pulse" />
          Na żywo
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
        <span className="font-mono text-[var(--wc-gold)]/80">
          {match.fixtureNumber ? `M${match.fixtureNumber}` : "—"}
        </span>
        <span className="text-white/25">·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatPolishTime(match.kickoffTime)}
        </span>
        {match.stage && (
          <>
            <span className="text-white/25">·</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-white/60">{match.stage}</span>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
          <TeamWithFlag
            name={match.homeTeam}
            flagWidth={36}
            layout="stack"
            nameClassName="text-sm font-semibold text-white/90 leading-tight"
          />
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 px-2">
          {finished || live ? (
            <span className="font-display text-2xl font-bold tracking-wider text-white">
              {match.homeScore ?? 0}
              <span className="mx-1 text-white/30">:</span>
              {match.awayScore ?? 0}
            </span>
          ) : (
            <span className="rounded-xl border border-[var(--wc-gold)]/30 bg-black/20 px-3 py-1 font-display text-lg font-bold text-[var(--wc-gold)]">
              VS
            </span>
          )}
          {finished && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
              <CheckCircle2 className="h-3 w-3" />
              Rozegrany
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:items-end sm:text-right">
          <TeamWithFlag
            name={match.awayTeam}
            flagWidth={36}
            layout="stack"
            nameClassName="text-sm font-semibold text-white/90 leading-tight"
          />
        </div>
      </div>

      {city && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/40 sm:justify-start">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--wc-gold)]/60" />
          {city}
        </p>
      )}
    </article>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<CalendarMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewYear, setViewYear] = useState(TOURNAMENT_START.year);
  const [viewMonth, setViewMonth] = useState(TOURNAMENT_START.month);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<CalendarResponse>("/calendar");
        setMatches(data.matches);
        const initial = getInitialMonth(data.matches);
        setViewYear(initial.year);
        setViewMonth(initial.month);

        const todayKey = toPolishDateKey(new Date());
        const todayHasMatches = data.matches.some(
          (m) => toPolishDateKey(m.kickoffTime) === todayKey,
        );
        if (todayHasMatches) {
          setSelectedDay(todayKey);
        } else {
          const firstUpcoming = data.matches.find(
            (m) => m.status === "PENDING" && new Date(m.kickoffTime) >= new Date(),
          );
          setSelectedDay(firstUpcoming ? toPolishDateKey(firstUpcoming.kickoffTime) : null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się załadować kalendarza");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const matchesByDay = useMemo(() => {
    const map = new Map<string, CalendarMatch[]>();
    for (const match of matches) {
      const key = toPolishDateKey(match.kickoffTime);
      const list = map.get(key) ?? [];
      list.push(match);
      map.set(key, list);
    }
    return map;
  }, [matches]);

  const monthCells = useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const selectedMatches = selectedDay ? (matchesByDay.get(selectedDay) ?? []) : [];

  const canGoPrev =
    monthIndex(viewYear, viewMonth) > monthIndex(TOURNAMENT_START.year, TOURNAMENT_START.month);
  const canGoNext =
    monthIndex(viewYear, viewMonth) < monthIndex(TOURNAMENT_END.year, TOURNAMENT_END.month);

  function changeMonth(delta: number) {
    const next = clampMonth(viewYear, viewMonth + delta);
    setViewYear(next.year);
    setViewMonth(next.month);

    const prefix = `${next.year}-${String(next.month + 1).padStart(2, "0")}`;
    const firstDayWithMatch = [...matchesByDay.keys()]
      .filter((k) => k.startsWith(prefix))
      .sort()[0];
    setSelectedDay(firstDayWithMatch ?? null);
  }

  const monthMatchCount = [...matchesByDay.entries()]
    .filter(([key]) => key.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`))
    .reduce((sum, [, list]) => sum + list.length, 0);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/50">
        Ładowanie kalendarza meczów…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-pitch p-6 text-center text-red-400">{error}</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="wc-page-title flex items-center gap-2">
            <CalendarDays className="h-7 w-7 shrink-0" />
            Kalendarz meczów
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Terminarz MŚ 2026 w czasie polskim. {matches.length} meczów · czerwiec–lipiec 2026.
            {!user && " Dostępny bez logowania."}
          </p>
        </div>
        {user && (
          <Link to="/dashboard" className="btn-primary shrink-0 self-start text-sm sm:self-auto">
            Przejdź do typowania
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="card-pitch overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[var(--wc-usa)]/20 via-[var(--wc-gold)]/10 to-[var(--wc-canada)]/20 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={!canGoPrev}
              className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Poprzedni miesiąc"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <p className="font-display text-xl capitalize tracking-wide text-[var(--wc-gold)] sm:text-2xl">
                {formatPolishMonthYear(viewYear, viewMonth)}
              </p>
              <p className="mt-0.5 text-xs text-white/40">
                {monthMatchCount} {monthMatchCount === 1 ? "mecz" : monthMatchCount < 5 ? "mecze" : "meczów"} w tym miesiącu
              </p>
            </div>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={!canGoNext}
              className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Następny miesiąc"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.03]">
            {CALENDAR_WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/35 sm:text-xs"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-white/5 p-px">
            {monthCells.map((dateKey, i) => {
              if (!dateKey) {
                return <div key={`empty-${i}`} className="min-h-[4.5rem] bg-[#0a0f18] sm:min-h-[5.5rem]" />;
              }

              const dayMatches = matchesByDay.get(dateKey) ?? [];
              const dayNum = Number(dateKey.split("-")[2]);
              const isSelected = selectedDay === dateKey;
              const isToday = dateKey === toPolishDateKey(new Date());
              const hasLive = dayMatches.some((m) => m.status === "LIVE");
              const hasFinished = dayMatches.some((m) => m.status === "FINISHED");
              const preview = dayMatches.slice(0, 3);

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDay(dateKey)}
                  className={`group relative flex min-h-[4.5rem] flex-col bg-[#0a0f18] p-1.5 text-left transition sm:min-h-[5.5rem] sm:p-2 ${
                    isSelected
                      ? "ring-2 ring-inset ring-[var(--wc-gold)] bg-[var(--wc-gold)]/10"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${
                      isToday
                        ? "bg-[var(--wc-gold)] text-[var(--wc-bg)]"
                        : isSelected
                          ? "text-[var(--wc-gold)]"
                          : "text-white/70"
                    }`}
                  >
                    {dayNum}
                  </span>

                  {dayMatches.length > 0 && (
                    <div className="mt-auto space-y-1">
                      <div className="flex flex-wrap gap-0.5">
                        {preview.map((m) => (
                          <TeamWithFlag
                            key={m.id}
                            name={m.homeTeam}
                            flagWidth={14}
                            showName={false}
                          />
                        ))}
                        {dayMatches.length > 3 && (
                          <span className="flex h-[10px] w-[14px] items-center justify-center rounded-sm bg-white/15 text-[8px] font-bold text-white/60">
                            +{dayMatches.length - 3}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`rounded px-1 py-px text-[9px] font-bold sm:text-[10px] ${
                            hasLive
                              ? "bg-red-500/25 text-red-300"
                              : "bg-[var(--wc-gold)]/15 text-[var(--wc-gold)]"
                          }`}
                        >
                          {dayMatches.length}
                        </span>
                        {hasFinished && !hasLive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" title="Rozegrane mecze" />
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="card-pitch border-[var(--wc-gold)]/20 bg-gradient-to-br from-[#111827] to-[#0a0f18] p-5">
            <h3 className="font-display text-lg text-[var(--wc-gold)]">
              {selectedDay ? formatPolishDateLong(selectedDay) : "Wybierz dzień"}
            </h3>
            <p className="mt-1 text-sm text-white/45">
              {selectedDay
                ? selectedMatches.length > 0
                  ? `${selectedMatches.length} ${selectedMatches.length === 1 ? "mecz" : selectedMatches.length < 5 ? "mecze" : "meczów"} · czas polski (CEST/CET)`
                  : "Brak meczów w tym dniu"
                : "Kliknij dzień w kalendarzu, aby zobaczyć szczegóły"}
            </p>
          </div>

          {selectedDay && selectedMatches.length > 0 ? (
            <div className="space-y-3">
              {selectedMatches.map((match) => (
                <MatchTimelineCard key={match.id} match={match} />
              ))}
            </div>
          ) : selectedDay ? (
            <div className="card-pitch p-8 text-center text-sm text-white/40">
              W tym dniu nie zaplanowano meczów MŚ 2026.
            </div>
          ) : null}

          {!user && (
            <div className="card-pitch border-dashed border-[var(--wc-gold)]/25 p-5 text-center">
              <p className="text-sm text-white/60">
                Chcesz typować wyniki?{" "}
                <Link to="/register" className="font-semibold text-[var(--wc-gold)] hover:underline">
                  Dołącz do ligi
                </Link>{" "}
                lub{" "}
                <Link to="/login" className="text-[var(--wc-gold)] hover:underline">
                  zaloguj się
                </Link>
                .
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
