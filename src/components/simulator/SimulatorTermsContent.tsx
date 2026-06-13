type Props = {
  className?: string;
};

export function SimulatorTermsContent({ className = "" }: Props) {
  return (
    <article className={`space-y-6 text-sm leading-relaxed text-white/75 ${className}`}>
      <header className="space-y-2 border-b border-white/10 pb-4">
        <h2 className="font-display text-2xl text-[var(--wc-gold)]">
          Zasady gry towarzyskiej i regulamin
        </h2>
        <p>Witamy w strefie aktywności!</p>
        <p>
          To miejsce, gdzie możesz zdobywać i wykorzystywać punkty aktywności, biorąc udział w
          zabawie z typami na mecze Mundialu 2026. Zanim zaczniesz, sprawdź, jak działa nasz system.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-white">🏆 Jak zdobywać punkty aktywności?</h3>
        <p>
          Punktów aktywności nie da się kupić za prawdziwe pieniądze. Każdy zdobywasz swoją
          aktywnością w aplikacji!
        </p>
        <p>
          <strong className="text-white">Na start otrzymujesz: 1000 punktów aktywności!</strong> A oto
          jak zdobywać kolejne:
        </p>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="font-semibold text-white">1. Za typowanie w Głównej Lidze:</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>
              <strong className="text-[var(--wc-gold)]">+5 pkt</strong> – Za samo zapisanie typu na
              mecz (nagroda za systematyczność).
            </li>
            <li>
              <strong className="text-[var(--wc-gold)]">+10 pkt</strong> – Gdy Twój typ w lidze
              zdobędzie 1 punkt (poprawny zwycięzca/remis).
            </li>
            <li>
              <strong className="text-[var(--wc-gold)]">+30 pkt</strong> – Gdy ustrzelisz dokładny
              wynik w lidze (3 punkty).
            </li>
            <li>
              <strong className="text-[var(--wc-gold)]">+40 pkt</strong> – Gdy trafisz maksymalnie w
              fazie pucharowej (idealny wynik + awans = 4 punkty).
            </li>
          </ul>
          <p className="text-xs text-white/45">
            (Bonusy za punkty ligowe wpadają na konto automatycznie po rozliczeniu meczu!)
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="font-semibold text-white">2. Za aktywność towarzyską:</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>
              <strong className="text-[var(--wc-gold)]">+5 pkt</strong> – Za przebywanie na stronie i
              śledzenie wyników LIVE (bonus maksymalnie raz na 15 minut).
            </li>
            <li>
              <strong className="text-[var(--wc-gold)]">+3 pkt</strong> – Za wiadomość na czacie
              (maksymalnie raz na 15 minut).
            </li>
            <li>
              <strong className="text-[var(--wc-gold)]">+1 pkt</strong> – Za reakcję (np. serduszko)
              pod wiadomością na czacie.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg text-white">⚖️ Regulamin modułu</h3>

        <div className="space-y-2">
          <h4 className="font-semibold text-white">§1. Postanowienia ogólne</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>
              Moduł „Gra towarzyska” jest wyłącznie bezpłatną zabawą o charakterze
              rozrywkowo-społecznym w ramach aplikacji.
            </li>
            <li>
              W module nie uczestniczą prawdziwe środki finansowe (PLN ani inne waluty), kryptowaluty
              ani przedmioty o wartości materialnej.
            </li>
            <li>
              Akceptując regulamin, oświadczasz, że rozumiesz czysto rozrywkowy charakter modułu i
              nie będziesz rościć z jego tytułu żadnych praw majątkowych.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white">§2. Dostęp do modułu</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>
              Dostęp jest limitowany, ma charakter prywatny i przyznawany wyłącznie zaproszonym
              użytkownikom.
            </li>
            <li>
              Administrator może odebrać dostęp dowolnemu użytkownikowi bez podania przyczyny. Utrata
              dostępu nie oznacza usunięcia z głównej Ligi Typerów.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white">§3. Punkty aktywności</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Punkty aktywności nie mają wartości pieniężnej (0,00 PLN).</li>
            <li>
              Zabrania się handlu punktami, wymiany na pieniądze lub nagrody poza aplikacją.
            </li>
            <li>
              Punktów nie można doładować za pieniądze ani przenieść na konto innego gracza.
            </li>
            <li>
              Administrator może ręcznie skorygować saldo punktów dowolnego gracza w razie nadużyć.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white">§4. Typy bonusowe i rozliczenia (1X2)</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>
              Moduł pozwala wykorzystać punkty aktywności w typach bonusowych 1X2 (Gospodarz /
              Remis / Gość).
            </li>
            <li>Mnożnik zatwierdzony w momencie zapisu typu jest ostateczny.</li>
            <li>
              Typy rozliczane są na podstawie oficjalnego wyniku meczu w bazie aplikacji.
            </li>
            <li>
              W razie błędu systemu Administrator może anulować typ (zwrot punktów) lub ręcznie
              skorygować rozliczenie. Decyzja Administratora jest ostateczna.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white">§5. Błędy techniczne i nadużycia</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>
              Aplikacja jest projektem hobbystycznym. Administrator nie gwarantuje bezbłędnego
              działania skryptów rozliczających.
            </li>
            <li>
              Wykorzystywanie błędów w kodzie do nieuczciwego nabijania punktów skutkuje banem w
              module oraz wyzerowaniem salda.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white">§6. Postanowienia końcowe</h4>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Ranking aktywności służy wyłącznie celom humorystycznym i towarzyskim.</li>
            <li>
              Kliknięcie „Akceptuję regulamin” oznacza zgodę na zasady modułu i grę wyłącznie dla
              zabawy.
            </li>
          </ul>
        </div>
      </section>
    </article>
  );
}
