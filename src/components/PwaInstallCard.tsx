import { Smartphone, Share, PlusSquare, Download } from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";

type Props = {
  compact?: boolean;
};

export function PwaInstallCard({ compact = false }: Props) {
  const {
    installed,
    installing,
    showInstallButton,
    showIosGuide,
    showManualGuide,
    install,
    isMobile,
  } = usePwaInstall();

  if (installed) {
    if (compact) return null;
    return (
      <section className="card-pitch flex items-center gap-3 border-emerald-500/20 bg-emerald-500/5 p-5">
        <Smartphone className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-emerald-200/90">
          Aplikacja jest już zainstalowana na Twoim urządzeniu.
        </p>
      </section>
    );
  }

  if (!isMobile && !showInstallButton) return null;

  if (compact) {
    if (!isMobile) return null;

    if (showInstallButton) {
      return (
        <button
          type="button"
          onClick={() => void install()}
          disabled={installing}
          className="btn-ghost text-sm"
        >
          <Download className="h-4 w-4" />
          {installing ? "Instalowanie…" : "Zainstaluj aplikację na telefonie"}
        </button>
      );
    }

    return (
      <details className="group text-left text-sm">
        <summary className="btn-ghost inline-flex cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
          <Smartphone className="h-4 w-4" />
          Zainstaluj aplikację na telefonie
        </summary>
        <div className="mx-auto mt-3 max-w-sm rounded-xl border border-white/10 bg-white/5 p-4 text-left text-xs text-white/65">
          {showIosGuide ? (
            <p>
              Safari: <Share className="inline h-3.5 w-3.5 text-[var(--wc-gold)]" /> Udostępnij →{" "}
              <PlusSquare className="inline h-3.5 w-3.5 text-[var(--wc-gold)]" /> Dodaj do ekranu
              początkowego
            </p>
          ) : (
            <p>
              Chrome: menu <span className="text-white/45">(⋮)</span> → Dodaj do ekranu głównego /
              Zainstaluj aplikację
            </p>
          )}
        </div>
      </details>
    );
  }

  return (
    <section className="card-pitch flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-[var(--wc-gold)]">
        <Smartphone className="h-5 w-5" />
        <h3 className="font-semibold">Aplikacja na telefonie</h3>
      </div>

      <p className="text-sm leading-relaxed text-white/60">
        Dodaj skrót na ekran główny — szybki dostęp do ligi bez wpisywania adresu w
        przeglądarce.
      </p>

      {showInstallButton && (
        <button
          type="button"
          onClick={() => void install()}
          disabled={installing}
          className="btn-primary w-full"
        >
          <Download className="h-4 w-4" />
          {installing ? "Instalowanie…" : "Zainstaluj aplikację na telefonie"}
        </button>
      )}

      {showIosGuide && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p className="font-medium text-white/85">iPhone / iPad (Safari)</p>
          <ol className="mt-3 space-y-2">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wc-gold)]/20 text-xs font-bold text-[var(--wc-gold)]">
                1
              </span>
              <span>
                Kliknij <Share className="inline h-4 w-4 text-[var(--wc-gold)]" />{" "}
                <strong>Udostępnij</strong> na dole ekranu
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wc-gold)]/20 text-xs font-bold text-[var(--wc-gold)]">
                2
              </span>
              <span>
                Wybierz <PlusSquare className="inline h-4 w-4 text-[var(--wc-gold)]" />{" "}
                <strong>Dodaj do ekranu początkowego</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wc-gold)]/20 text-xs font-bold text-[var(--wc-gold)]">
                3
              </span>
              <span>Potwierdź — ikona ligi pojawi się na pulpicie</span>
            </li>
          </ol>
        </div>
      )}

      {showManualGuide && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p className="font-medium text-white/85">Android (Chrome)</p>
          <p className="mt-2">
            Otwórz menu przeglądarki <span className="text-white/50">(⋮)</span> i wybierz{" "}
            <strong>Dodaj do ekranu głównego</strong> lub <strong>Zainstaluj aplikację</strong>.
          </p>
        </div>
      )}

      {!showInstallButton && !showIosGuide && !showManualGuide && isMobile && (
        <p className="text-sm text-white/45">
          Otwórz stronę w przeglądarce na telefonie, aby zobaczyć opcję instalacji.
        </p>
      )}
    </section>
  );
}
