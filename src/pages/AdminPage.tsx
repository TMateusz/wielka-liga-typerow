import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, History, Pencil } from "lucide-react";
import { formatLastActive } from "@shared/relative-time";
import { api } from "../api/client";
import { AdminResultForm } from "../components/AdminResultForm";
import { AdminUsersPanel } from "../components/AdminUsersPanel";
import type { KnockoutSide } from "@shared/knockout";
import { isPlaceholderMatch } from "@shared/placeholders";
import { TeamWithFlag } from "../components/TeamWithFlag";

type AdminMatch = {
  id: string;
  fixtureNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: string;
  stage: string | null;
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner: string | null;
  predictionCount?: number;
  playerCount?: number;
};

type ResultHistoryEntry = {
  id: string;
  createdAt: string;
  adminNickname: string;
  adminName: string;
  match: {
    homeTeam: string;
    awayTeam: string;
    stage: string | null;
    fixtureNumber: number | null;
  };
  homeScore: number;
  awayScore: number;
  knockoutWinner: string | null;
  previousHomeScore: number | null;
  previousAwayScore: number | null;
  isCorrection: boolean;
};

type Filter = "to_settle" | "pending" | "placeholders" | "finished" | "all";
type AdminTab = "matches" | "users";

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("matches");
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("to_settle");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resultHistory, setResultHistory] = useState<ResultHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadMatches = useCallback(() => {
    return api<AdminMatch[]>("/admin/matches").then(setMatches);
  }, []);

  const loadResultHistory = useCallback(() => {
    return api<ResultHistoryEntry[]>("/admin/result-history").then(setResultHistory);
  }, []);

  useEffect(() => {
    Promise.all([loadMatches(), loadResultHistory()]).finally(() => setLoading(false));
  }, [loadMatches, loadResultHistory]);

  const placeholderCount = useMemo(
    () =>
      matches.filter((m) => m.status !== "FINISHED" && isPlaceholderMatch(m.homeTeam, m.awayTeam))
        .length,
    [matches]
  );

  const toSettleCount = useMemo(
    () =>
      matches.filter(
        (m) => m.status !== "FINISHED" && new Date(m.kickoffTime).getTime() < Date.now()
      ).length,
    [matches]
  );

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (
        filter === "to_settle" &&
        (m.status === "FINISHED" || new Date(m.kickoffTime).getTime() >= Date.now())
      ) {
        return false;
      }
      if (filter === "pending" && m.status === "FINISHED") return false;
      if (filter === "finished" && m.status !== "FINISHED") return false;
      if (
        filter === "placeholders" &&
        (m.status === "FINISHED" || !isPlaceholderMatch(m.homeTeam, m.awayTeam))
      ) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${m.homeTeam} ${m.awayTeam} ${m.stage}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matches, filter, search]);

  const pendingCount = matches.filter((m) => m.status !== "FINISHED").length;
  const finishedCount = matches.filter((m) => m.status === "FINISHED").length;

  async function submitTeams(e: FormEvent<HTMLFormElement>, matchId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    try {
      const updated = await api<AdminMatch>(`/admin/matches/${matchId}/teams`, {
        method: "PATCH",
        body: JSON.stringify({
          homeTeam: form.get("homeTeam"),
          awayTeam: form.get("awayTeam"),
        }),
      });
      setMatches((prev) => prev.map((m) => (m.id === matchId ? updated : m)));
      setEditingId(null);
      setMessage("Drużyny zaktualizowane — gracze zobaczą prawdziwe nazwy w Meczach i Rankingu.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Błąd zapisu drużyn");
    }
  }

  async function submitResult(
    matchId: string,
    homeScore: number,
    awayScore: number,
    knockoutWinner: KnockoutSide | null
  ) {
    try {
      await api(`/admin/matches/${matchId}/result`, {
        method: "POST",
        body: JSON.stringify({ homeScore, awayScore, knockoutWinner }),
      });
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                homeScore,
                awayScore,
                knockoutWinner,
                status: "FINISHED",
              }
            : m
        )
      );
      const wasFinished = matches.find((m) => m.id === matchId)?.status === "FINISHED";
      setMessage(
        wasFinished
          ? "Wynik poprawiony — ranking przeliczony!"
          : "Wynik zapisany — punkty naliczone w rankingu!"
      );
      void loadResultHistory();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Błąd zapisu wyniku");
    }
  }

  if (loading) {
    return <p className="text-white/60">Ładowanie panelu admina…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Panel administracyjny</h2>
        <p className="text-white/60">
          Zarządzaj meczami, wynikami i kontami graczy.
        </p>
        <p className="mt-1 text-sm text-[var(--gold)]">
          Terminarz MŚ 2026: <strong>{matches.length}</strong> meczów
          {placeholderCount > 0 && (
            <span className="text-amber-300">
              {" "}
              · <strong>{placeholderCount}</strong> meczów czeka na nazwy drużyn
            </span>
          )}
        </p>
      </div>

      {message && (
        <p className="rounded-lg bg-[var(--gold)]/20 px-4 py-2 text-sm text-[var(--gold)]">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["matches", "Mecze"],
            ["users", "Gracze"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`btn-ghost text-sm ${tab === key ? "border-[var(--gold)] text-[var(--gold)]" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <AdminUsersPanel onMessage={setMessage} />
      ) : (
        <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["to_settle", `Do rozliczenia (${toSettleCount})`],
              ["pending", `Nadchodzące (${pendingCount})`],
              ["placeholders", `Bez drużyn (${placeholderCount})`],
              ["finished", `Zakończone (${finishedCount})`],
              ["all", `Wszystkie (${matches.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`btn-ghost text-sm ${filter === key ? "border-[var(--gold)] text-[var(--gold)]" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Szukaj drużyny…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm outline-none focus:border-[var(--gold)]"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-white/50">Brak meczów w tym filtrze.</p>
        )}
        {filtered.map((match) => {
          const placeholder = isPlaceholderMatch(match.homeTeam, match.awayTeam);
          const isEditing = editingId === match.id;

          return (
            <div key={match.id} className="card-pitch space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {match.fixtureNumber && (
                    <span className="text-xs text-white/40">Mecz #{match.fixtureNumber} · </span>
                  )}
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    <TeamWithFlag name={match.homeTeam} flagWidth={18} />
                    <span className="text-white/40">vs</span>
                    <TeamWithFlag name={match.awayTeam} flagWidth={18} />
                  </p>
                  <p className="text-sm text-white/50">
                    {match.stage} · {new Date(match.kickoffTime).toLocaleString("pl-PL")}
                  </p>
                  {match.playerCount != null && (
                    <p className="text-xs text-white/40">
                      Typowało:{" "}
                      <strong className="text-white/60">{match.predictionCount ?? 0}</strong> /{" "}
                      {match.playerCount} graczy
                    </p>
                  )}
                  {placeholder && match.status !== "FINISHED" && (
                    <span className="mt-1 inline-block rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                      Uzupełnij drużyny przed typowaniem
                    </span>
                  )}
                </div>

                {match.status !== "FINISHED" && (
                  <button
                    type="button"
                    onClick={() => setEditingId(isEditing ? null : match.id)}
                    className="btn-ghost shrink-0 text-sm"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {isEditing ? "Anuluj" : "Edytuj drużyny"}
                  </button>
                )}
              </div>

              {isEditing && (
                <form
                  onSubmit={(e) => submitTeams(e, match.id)}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3 sm:flex-row sm:items-end"
                >
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-white/50">Gospodarze</label>
                    <input
                      name="homeTeam"
                      defaultValue={match.homeTeam}
                      required
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                      placeholder="np. Polska"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-white/50">Goście</label>
                    <input
                      name="awayTeam"
                      defaultValue={match.awayTeam}
                      required
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                      placeholder="np. Brazylia"
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    Zapisz drużyny
                  </button>
                </form>
              )}

              <AdminResultForm
                key={`${match.id}-${match.homeScore}-${match.awayScore}-${match.knockoutWinner}`}
                matchId={match.id}
                stage={match.stage}
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                homeScore={match.homeScore}
                awayScore={match.awayScore}
                knockoutWinner={match.knockoutWinner}
                finished={match.status === "FINISHED"}
                onSubmit={submitResult}
              />
            </div>
          );
        })}
      </div>

      <section className="card-pitch overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
        >
          <span className="flex items-center gap-2 font-semibold text-[var(--gold)]">
            <History className="h-4 w-4" />
            Historia wyników ({resultHistory.length})
          </span>
          {historyOpen ? (
            <ChevronUp className="h-4 w-4 text-white/50" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/50" />
          )}
        </button>
        {historyOpen && (
          <div className="border-t border-white/10 px-4 py-3">
            {resultHistory.length === 0 ? (
              <p className="text-sm text-white/45">Brak zapisanych wyników.</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                {resultHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <p className="text-white/80">
                      {entry.match.homeTeam} {entry.homeScore}:{entry.awayScore}{" "}
                      {entry.match.awayTeam}
                      {entry.isCorrection && (
                        <span className="ml-2 text-xs text-amber-300">(poprawka)</span>
                      )}
                    </p>
                    <p className="text-xs text-white/45">
                      {entry.match.stage}
                      {entry.match.fixtureNumber ? ` · Mecz #${entry.match.fixtureNumber}` : ""}
                      {" · "}
                      {formatLastActive(entry.createdAt)} · admin: {entry.adminNickname}
                      {entry.isCorrection &&
                        entry.previousHomeScore != null &&
                        entry.previousAwayScore != null && (
                          <>
                            {" · "}
                            było {entry.previousHomeScore}:{entry.previousAwayScore}
                          </>
                        )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
