import { CalendarClock } from "lucide-react";
import { canBetOnMatch } from "@shared/scoring";
import { TeamWithFlag } from "./TeamWithFlag";
import type { MatchData } from "./MatchCard";

function formatKickoff(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type Props = {
  matches: MatchData[];
  limit?: number;
};

export function UpcomingBetsStrip({ matches, limit = 3 }: Props) {
  const now = new Date();
  const upcoming = matches
    .filter((m) => canBetOnMatch(m.status, new Date(m.kickoffTime), now))
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())
    .slice(0, limit);

  if (upcoming.length === 0) return null;

  return (
    <section className="card-pitch space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-[var(--wc-gold)]">
          <CalendarClock className="h-4 w-4" />
          Najbliższe mecze do typowania
        </h3>
        <span className="text-xs text-white/40">Pamiętaj — max. 3 dni przed startem</span>
      </div>
      <ul className="space-y-2">
        {upcoming.map((match) => (
          <li
            key={match.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--wc-gold)]/15 bg-[var(--wc-gold)]/5 px-3 py-2 text-sm"
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
              <TeamWithFlag name={match.homeTeam} flagWidth={16} />
              <span className="text-white/40">vs</span>
              <TeamWithFlag name={match.awayTeam} flagWidth={16} />
            </span>
            <span className="text-white/50">{formatKickoff(match.kickoffTime)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-white/40">
        {upcoming.some((m) => !m.prediction)
          ? "Masz mecze bez typu — przewiń do listy poniżej i uzupełnij typy."
          : "Masz typy na wszystkie pokazane mecze."}
      </p>
    </section>
  );
}
