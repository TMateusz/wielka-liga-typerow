import type { KnockoutSide } from "@shared/knockout";
import { TeamWithFlag } from "./TeamWithFlag";

type Props = {
  homeTeam: string;
  awayTeam: string;
  value: KnockoutSide | null;
  onChange: (value: KnockoutSide) => void;
  disabled?: boolean;
};

export function KnockoutWinnerPick({ homeTeam, awayTeam, value, onChange, disabled }: Props) {
  const base =
    "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm transition disabled:opacity-50";
  const active = "border-[var(--wc-gold)] bg-[var(--wc-gold)]/15 text-white";
  const idle = "border-white/15 bg-white/5 text-white/70 hover:bg-white/10";

  return (
    <div className="w-full max-w-md space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-center text-xs text-white/55">Drużyna, która awansuje</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("HOME")}
          className={`${base} ${value === "HOME" ? active : idle}`}
        >
          <TeamWithFlag name={homeTeam} flagWidth={16} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("AWAY")}
          className={`${base} ${value === "AWAY" ? active : idle}`}
        >
          <TeamWithFlag name={awayTeam} flagWidth={16} />
        </button>
      </div>
    </div>
  );
}
