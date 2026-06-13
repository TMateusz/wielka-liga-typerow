import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { formatOddsDecimal } from "@shared/simulator";
import {
  marginPercent,
  rebalanceOdds,
  type OddsField,
  type OddsTriple,
} from "@shared/odds-rebalance";
import { api } from "../api/client";

export type SimulatorOddsDto = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  source: string;
  fetchedAt: string;
};

type Props = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  disabled?: boolean;
  initialOdds: SimulatorOddsDto | null;
  onSaved: (odds: SimulatorOddsDto) => void;
  onMessage: (msg: string) => void;
};

export function AdminOddsEditor({
  matchId,
  homeTeam,
  awayTeam,
  disabled,
  initialOdds,
  onSaved,
  onMessage,
}: Props) {
  const [odds, setOdds] = useState<OddsTriple | null>(
    initialOdds
      ? {
          homeOdds: initialOdds.homeOdds,
          drawOdds: initialOdds.drawOdds,
          awayOdds: initialOdds.awayOdds,
        }
      : null,
  );
  const [source, setSource] = useState(initialOdds?.source ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [draft, setDraft] = useState<Record<OddsField, string>>({
    homeOdds: "",
    drawOdds: "",
    awayOdds: "",
  });

  const syncDraft = useCallback((next: OddsTriple) => {
    setDraft({
      homeOdds: formatOddsDecimal(next.homeOdds),
      drawOdds: formatOddsDecimal(next.drawOdds),
      awayOdds: formatOddsDecimal(next.awayOdds),
    });
  }, []);

  useEffect(() => {
    if (initialOdds) {
      const next = {
        homeOdds: initialOdds.homeOdds,
        drawOdds: initialOdds.drawOdds,
        awayOdds: initialOdds.awayOdds,
      };
      setOdds(next);
      setSource(initialOdds.source);
      syncDraft(next);
    }
  }, [initialOdds, syncDraft]);

  async function persist(field: OddsField, value: number, preview: OddsTriple) {
    setSaving(true);
    try {
      const saved = await api<SimulatorOddsDto>(`/admin/matches/${matchId}/odds`, {
        method: "PATCH",
        body: JSON.stringify({ field, value }),
      });
      setOdds(preview);
      setSource(saved.source);
      syncDraft(preview);
      onSaved(saved);
      onMessage("Kursy zapisane — pozostałe wyniki przeliczone automatycznie.");
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Błąd zapisu kursów");
      if (odds) syncDraft(odds);
    } finally {
      setSaving(false);
    }
  }

  function handleBlur(field: OddsField) {
    if (disabled || saving) return;

    const raw = draft[field].replace(",", ".");
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) {
      if (odds) syncDraft(odds);
      return;
    }

    const base = odds ?? {
      homeOdds: 2.1,
      drawOdds: 3.2,
      awayOdds: 3.4,
    };

    if (Math.abs(value - base[field]) < 0.005) return;

    try {
      const preview = rebalanceOdds(base, field, value);
      void persist(field, value, preview);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Nieprawidłowy kurs");
      syncDraft(base);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const saved = await api<SimulatorOddsDto>(`/admin/matches/${matchId}/odds/reset`, {
        method: "POST",
      });
      const next = {
        homeOdds: saved.homeOdds,
        drawOdds: saved.drawOdds,
        awayOdds: saved.awayOdds,
      };
      setOdds(next);
      setSource(saved.source);
      syncDraft(next);
      onSaved(saved);
      onMessage("Przywrócono kursy z modelu siły drużyn.");
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Błąd resetu kursów");
    } finally {
      setResetting(false);
    }
  }

  const fields: { field: OddsField; label: string }[] = [
    { field: "homeOdds", label: `1 — ${homeTeam}` },
    { field: "drawOdds", label: "X — remis" },
    { field: "awayOdds", label: `2 — ${awayTeam}` },
  ];

  return (
    <div className="rounded-lg border border-white/15 bg-white/[0.03] p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-white/60">Kursy symulatora (aktywność)</p>
        {odds && (
          <span className="text-[10px] text-white/35">
            marża ~{marginPercent(odds)}%
            {source === "admin-manual" && " · edycja admina"}
          </span>
        )}
      </div>
      <p className="text-[10px] text-white/35">
        Zmiana jednego kursu automatycznie przelicza pozostałe (niższy u gospodarzy → wyższy u gości).
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {fields.map(({ field, label }) => (
          <div key={field}>
            <label className="mb-1 block truncate text-[10px] text-white/45" title={label}>
              {label}
            </label>
            <input
              type="text"
              inputMode="decimal"
              disabled={disabled || saving || resetting}
              value={draft[field]}
              onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
              onBlur={() => handleBlur(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--gold)]"
              placeholder="np. 2.10"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || saving || resetting}
        onClick={() => void handleReset()}
        className="btn-ghost text-xs"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Przywróć model Elo
      </button>
    </div>
  );
}
