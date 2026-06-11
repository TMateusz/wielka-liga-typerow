import type { ReactNode } from "react";
import { RULES_LAST_UPDATED_AT, formatRulesLastUpdated } from "@shared/rules-meta";
import { BET_WINDOW_DAYS, SCORING, formatPoints } from "@shared/scoring";
import { BookOpen, Clock, Lock, MessageSquare, Radio, Shield, Trophy, Users } from "lucide-react";

function RuleSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BookOpen;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card-pitch space-y-3 p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--wc-gold)]">
        <Icon className="h-5 w-5 shrink-0" />
        {title}
      </h3>
      <div className="space-y-2 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

function PointRow({ points, label }: { points: number; label: string }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 rounded-md bg-[var(--wc-gold)]/15 px-2 py-0.5 text-center font-bold text-[var(--wc-gold)] min-w-[2.5rem]">
        +{formatPoints(points)}
      </span>
      <span>{label}</span>
    </li>
  );
}

function ExampleBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/75">
      {children}
    </div>
  );
}

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="wc-page-title">Regulamin: Wielka Liga Typerów – Mundial 2026</h2>
        <p className="mt-2 max-w-2xl text-white/60">
          Wszystko, co musisz wiedzieć, by ograć znajomych i wygrać ligę.
        </p>
        <p className="mt-3 text-sm text-white/50">
          Ostatnia modyfikacja:{" "}
          <time dateTime={RULES_LAST_UPDATED_AT.toISOString()} className="text-white/70">
            {formatRulesLastUpdated()}
          </time>
          {" · "}
          <span className="font-medium text-[var(--wc-gold)]/90">
            To jest ostateczna wersja regulaminu.
          </span>
        </p>
      </div>

      <RuleSection icon={Trophy} title="Cel gry i stawka">
        <p>
          Zasada jest prosta: typujesz wyniki meczów Mistrzostw Świata 2026 i zbierasz punkty.
          Wygrywa ten, kto po finale zgromadzi ich najwięcej. Nasz ranking jest ogólnodostępny —
          każdy może na bieżąco śledzić rywalizację w tabeli.
        </p>
        <p className="font-medium text-white/85">
          O co gramy? Rywalizujemy o wieczne uznanie, zaszczytny tytuł Króla Typerów i oczywiście
          o darmowe piwo!
        </p>
      </RuleSection>

      <RuleSection icon={BookOpen} title="System punktacji">
        <p className="font-medium text-white/85">Faza grupowa (maks. {SCORING.EXACT} pkt za mecz)</p>
        <p>
          W fazie grupowej typujemy ostateczny wynik spotkania. Punktacja wygląda następująco:
        </p>
        <ul className="mt-2 space-y-2">
          <PointRow
            points={SCORING.EXACT}
            label="Dokładny wynik — trafiasz idealnie liczbę bramek obu drużyn (np. obstawiasz 2:1, mecz kończy się 2:1)."
          />
          <PointRow
            points={SCORING.OUTCOME}
            label="Poprawne rozstrzygnięcie — wskazujesz właściwego zwycięzcę lub poprawnie przewidujesz remis, ale mylisz się w dokładnym wyniku bramkowym (np. obstawiasz 1:0, mecz kończy się 3:1)."
          />
          <PointRow
            points={SCORING.WRONG}
            label="Błędny typ — nietrafiony zwycięzca i brak remisu."
          />
        </ul>

        <p className="mt-4 font-medium text-white/85">
          Faza pucharowa (maks. {SCORING.KNOCKOUT_MAX} pkt za mecz)
        </p>
        <p>
          W meczach od 1/16 finału, gdzie przegrywający odpada, typujesz{" "}
          <strong className="text-white/90">wynik w regulaminowym czasie gry</strong> oraz{" "}
          <strong className="text-white/90">drużynę, która awansuje</strong>.
        </p>

        <p className="mt-3 font-medium text-white/80">1. Punkty za regulaminowy czas gry (do 90. minuty)</p>
        <p>
          Liczy się wyłącznie wynik po 90 minutach (wraz z doliczonym czasem, przed dogrywką).
          Punktacja jak w fazie grupowej:
        </p>
        <ul className="mt-2 space-y-2">
          <PointRow points={SCORING.EXACT} label="Dokładny wynik do 90. minuty." />
          <PointRow
            points={SCORING.OUTCOME}
            label="Poprawne rozstrzygnięcie (zwycięzca lub remis) do 90. minuty."
          />
          <PointRow points={SCORING.WRONG} label="Błędny typ na 90 minut." />
        </ul>

        <p className="mt-3 font-medium text-white/80">2. Bonus za awans (+{SCORING.KNOCKOUT_ADVANCE} pkt)</p>
        <p>
          Niezależnie od typu na 90 minut, otrzymujesz dodatkowy +{SCORING.KNOCKOUT_ADVANCE} pkt za
          poprawne wskazanie drużyny, która przejdzie do kolejnej rundy (w regulaminowym czasie,
          po dogrywce lub w rzutach karnych).
        </p>

        <ExampleBox>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wc-gold)]">
            Przykłady
          </p>
          <p className="text-white/55">
            Mecz kończy się 1:1 w 90. minucie, po rzutach karnych awansuje Brazylia:
          </p>
          <ul className="list-inside list-disc space-y-1 marker:text-[var(--wc-gold)]">
            <li>
              Typ: 1:1, awans Brazylia → <strong className="text-white/90">4 pkt</strong> (3 + 1)
            </li>
            <li>
              Typ: 0:0, awans Francja → <strong className="text-white/90">1 pkt</strong> (1 za remis,
              0 za awans)
            </li>
            <li>
              Typ: 2:0 dla Brazylii, awans Brazylia → <strong className="text-white/90">1 pkt</strong>{" "}
              (0 za wynik, 1 za awans)
            </li>
          </ul>
        </ExampleBox>

        <p className="mt-4 font-medium text-white/85">Remisy w tabeli końcowej</p>
        <p>
          Jeśli po finale dwóch lub więcej graczy ma taką samą liczbę punktów, o wyższym miejscu
          decyduje liczba trafionych <strong className="text-white/90">dokładnych wyników</strong>{" "}
          (zdobytych „trójek”). Kto miał lepszy nos do idealnego typowania, ten wygrywa ligę.
        </p>
      </RuleSection>

      <RuleSection icon={Clock} title="Kiedy można typować?">
        <ul className="list-inside list-disc space-y-2 marker:text-[var(--wc-gold)]">
          <li>
            <strong className="text-white/90">Otwarcie okna:</strong> typowanie odblokowuje się na{" "}
            {BET_WINDOW_DAYS * 24} godzin ({BET_WINDOW_DAYS} dni) przed rozpoczęciem meczu.
            Wcześniej nie ma możliwości oddania typu.
          </li>
          <li>
            <strong className="text-white/90">Edycja typów:</strong> do startu spotkania możesz
            dowolnie zmieniać przewidywania.
          </li>
          <li>
            <strong className="text-white/90">Koniec czasu:</strong> typowanie zostaje
            bezpowrotnie zablokowane w momencie planowanego pierwszego gwizdka.
          </li>
        </ul>
      </RuleSection>

      <RuleSection icon={Lock} title="Widoczność typów (zero ściągania!)">
        <ul className="list-inside list-disc space-y-2 marker:text-[var(--wc-gold)]">
          <li>Zanim mecz się rozpocznie, typy innych graczy są ściśle tajne.</li>
          <li>
            Karty odsłaniamy wraz z pierwszym gwizdkiem — gdy typowanie jest zablokowane, widać
            decyzje wszystkich graczy.
          </li>
          <li>Swoje własne typy zawsze widzisz w zakładce Mecze.</li>
        </ul>
      </RuleSection>

      <RuleSection icon={Radio} title="Wyniki i tabela na żywo (LIVE)">
        <p>
          Wyniki meczów, zdobyte punkty oraz główna tabela rankingowa są aktualizowane na żywo.
          Wraz z każdą zmianą wyniku na boisku system przelicza punkty — możesz śledzić
          przetasowania w rankingu w trakcie spotkania.
        </p>
        <p className="mt-2 text-white/55">
          Administrator zastrzega sobie prawo do ręcznej korekty wyniku po zakończeniu meczu w
          przypadku błędu systemu lub pomyłki w transmisji danych. Po korekcie punkty wszystkich
          graczy zostaną automatycznie przeliczone.
        </p>
      </RuleSection>

      <RuleSection icon={Users} title="Rejestracja i konto">
        <ul className="list-inside list-disc space-y-2 marker:text-[var(--wc-gold)]">
          <li>Liga jest zamknięta — dołączenie wymaga kodu zaproszenia od organizatora.</li>
          <li>
            Konto zakładasz samodzielnie. Wymagane jest podanie prawdziwego imienia i nazwiska —
            pod nimi figurować będziesz w publicznym rankingu.
          </li>
          <li>Dodatkowo ustalasz nick oraz hasło. Hasło możesz zmienić w panelu po zalogowaniu.</li>
        </ul>
      </RuleSection>

      <RuleSection icon={MessageSquare} title="Czat (kibicuj i dyskutuj)">
        <p>
          W aplikacji dostępny jest wewnętrzny czat dla wszystkich uczestników ligi. Zachęcamy do
          wspólnego przeżywania emocji i komentowania spotkań — prosimy jednak o kulturę i szacunek
          wobec innych typerów. Sportowe docinki są super, ale trzymajmy się granic dobrego smaku!
        </p>
      </RuleSection>

      <div className="card-pitch border-[var(--wc-gold)]/20 bg-[var(--wc-gold)]/5 p-4 text-sm text-white/65">
        <p className="font-medium text-[var(--wc-gold)]">W skrócie</p>
        <p className="mt-2">
          ⏳ Okno otwiera się na {BET_WINDOW_DAYS * 24}h przed meczem → 🔄 Edytujesz do pierwszego
          gwizdka → 💬 Dyskutujesz na czacie → ⚽ Śledzisz tabelę LIVE w trakcie meczu → 📈
          Zgarniasz punkty, pniesz się w rankingu i wygrywasz piwo!
        </p>
      </div>
    </div>
  );
}
