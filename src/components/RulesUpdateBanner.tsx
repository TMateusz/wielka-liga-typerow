import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

export function RulesUpdateBanner() {
  return (
    <div className="card-pitch flex flex-wrap items-start gap-3 border-[var(--wc-gold)]/25 bg-[var(--wc-gold)]/8 p-4 text-sm">
      <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[var(--wc-gold)]" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-white/90">
          Ostateczna wersja zasad gry została zaktualizowana
        </p>
        <p className="text-white/60">
          Sprawdź nową punktację (w tym fazę pucharową do 4 pkt) i pozostałe zasady przed
          typowaniem.
        </p>
        <Link
          to="/rules"
          className="inline-block font-medium text-[var(--wc-gold)] hover:underline"
        >
          Przejdź do regulaminu →
        </Link>
      </div>
    </div>
  );
}
