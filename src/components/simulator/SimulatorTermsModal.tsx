import { Link } from "react-router-dom";
import { SimulatorTermsContent } from "./SimulatorTermsContent";

type Props = {
  accepting: boolean;
  onAccept: () => void;
};

export function SimulatorTermsModal({ accepting, onAccept }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulator-terms-title"
    >
      <div className="card-pitch flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="simulator-terms-title" className="font-display text-xl text-[var(--wc-gold)]">
            Regulamin gry towarzyskiej
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Przed pierwszym użyciem musisz zaakceptować poniższe zasady.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <SimulatorTermsContent />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/symulator/regulamin"
            className="text-center text-xs text-[var(--wc-gold)]/80 hover:text-[var(--wc-gold)] hover:underline sm:text-left"
          >
            Otwórz pełny regulamin w nowej podstronie
          </Link>
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="btn-primary shrink-0 disabled:opacity-60"
          >
            {accepting ? "Zapisywanie…" : "Akceptuję regulamin"}
          </button>
        </div>
      </div>
    </div>
  );
}
