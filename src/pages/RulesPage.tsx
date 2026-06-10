import type { ReactNode } from "react";
import { BET_WINDOW_DAYS, SCORING, formatPoints } from "@shared/scoring";
import { BookOpen, Clock, Lock, Shield, Trophy, Users } from "lucide-react";

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

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="wc-page-title">Zasady gry</h2>
        <p className="mt-2 max-w-2xl text-white/60">
          Wszystko, co musisz wiedzieć o typowaniu w Wielkiej Lidze Typerów na Mistrzostwa Świata
          2026.
        </p>
      </div>

      <RuleSection icon={Trophy} title="Cel gry">
        <p>
          Typujesz wyniki meczów MŚ 2026 i zbierasz punkty. Kto ma ich najwięcej po turnieju —
          wygrywa ligę. Ranking jest publiczny — każdy może go podejrzeć bez logowania.
        </p>
      </RuleSection>

      <RuleSection icon={BookOpen} title="Punktacja">
        <p>Za każdy mecz możesz zdobyć:</p>
        <ul className="mt-2 space-y-2">
          <PointRow
            points={SCORING.EXACT}
            label="Dokładny wynik — trafiłeś obie bramki (np. typ 2:1, wynik 2:1)."
          />
          <PointRow
            points={SCORING.OUTCOME}
            label="Poprawny wynik — dobrałeś zwycięzcę lub remis, ale bez dokładnego wyniku bramkowego (np. typ 1:0, wynik 3:1)."
          />
          <PointRow
            points={SCORING.WRONG}
            label="Błędny typ — zły zwycięzca lub zły remis."
          />
        </ul>
        <p className="mt-3 font-medium text-white/85">Faza pucharowa (1/16, ćwierćfinały itd.)</p>
        <p>
          Przy remisie po 90 minutach wskaż też, kto wygra po dogrywce. Wtedy obowiązują dodatkowe
          zasady:
        </p>
        <ul className="mt-2 space-y-2">
          <PointRow
            points={SCORING.KNOCKOUT_DRAW_WINNER}
            label="Typujesz remis i trafiasz zwycięzcę po dogrywce."
          />
          <PointRow
            points={SCORING.OUTCOME}
            label="Typujesz remis, ale nie trafiasz zwycięzcy po dogrywce."
          />
          <PointRow
            points={SCORING.KNOCKOUT_WINNER_AFTER_REG_DRAW}
            label="Typujesz wygraną jednej ze stron w 90. minucie, a w rzeczywistości był remis — ale dobrałeś, kto wygrał po dogrywce."
          />
        </ul>
      </RuleSection>

      <RuleSection icon={Clock} title="Kiedy można typować">
        <ul className="list-inside list-disc space-y-2 marker:text-[var(--wc-gold)]">
          <li>
            Typ możesz złożyć lub zmienić najwcześniej{" "}
            <strong className="text-white/90">{BET_WINDOW_DAYS} dni przed</strong> rozpoczęciem
            meczu. Wcześniej mecz jest niedostępny do typowania.
          </li>
          <li>
            W oknie typowania możesz <strong className="text-white/90">edytować swój typ</strong>{" "}
            dowolną liczbę razy — do momentu blokady.
          </li>
          <li>
            W <strong className="text-white/90">momencie rozpoczęcia meczu</strong> (czas
            rozpoczęcia wg terminarza) typowanie jest{" "}
            <strong className="text-white/90">zablokowane</strong>. Nie da się już nic dopisać ani
            poprawić.
          </li>
        </ul>
      </RuleSection>

      <RuleSection icon={Shield} title="Wyniki i naliczanie punktów">
        <ul className="list-inside list-disc space-y-2 marker:text-[var(--wc-gold)]">
          <li>
            Po zakończeniu meczu <strong className="text-white/90">administrator wpisuje wynik</strong>{" "}
            w panelu admina.
          </li>
          <li>
            Dopiero wtedy punkty są <strong className="text-white/90">naliczane</strong> i
            aktualizują się w rankingu.
          </li>
          <li>
            Jeśli admin poprawi wynik, punkty są <strong className="text-white/90">przeliczane</strong>{" "}
            automatycznie.
          </li>
          <li>
            Do czasu zatwierdzenia wyniku przez admina mecz nie daje punktów — nawet jeśli znasz już
            wynik z telewizji.
          </li>
        </ul>
      </RuleSection>

      <RuleSection icon={Users} title="Ranking i widoczność typów">
        <ul className="list-inside list-disc space-y-2 marker:text-[var(--wc-gold)]">
          <li>Ranking jest publiczny — dostępny bez logowania.</li>
          <li>
            Typy innych graczy na <strong className="text-white/90">mecze jeszcze się nie rozpoczęte są ukryte</strong>.
            Po starcie meczu (gdy typowanie jest zablokowane) widać, kto na co postawił.
          </li>
          <li>
            Po zakończeniu meczu i wpisaniu wyniku przez admina widać także zdobyte punkty.
          </li>
          <li>Swoje typy zawsze widzisz w zakładce Mecze.</li>
        </ul>
      </RuleSection>

      <RuleSection icon={Lock} title="Rejestracja i konto">
        <ul className="list-inside list-disc space-y-2 marker:text-[var(--wc-gold)]">
          <li>Dołączenie do ligi wymaga kodu zaproszenia od organizatora.</li>
          <li>Rejestrujesz się samodzielnie — imię, nazwisko, nick i hasło.</li>
          <li>Hasło możesz zmienić w zakładce Hasło po zalogowaniu.</li>
        </ul>
      </RuleSection>

      <div className="card-pitch border-[var(--wc-gold)]/20 bg-[var(--wc-gold)]/5 p-4 text-sm text-white/65">
        <p className="font-medium text-[var(--wc-gold)]">W skrócie</p>
        <p className="mt-2">
          Typuj max. {BET_WINDOW_DAYS} dni przed meczem → edytuj do gwizdka → admin wpisuje wynik →
          dostajesz punkty → wspinasz się w rankingu.
        </p>
      </div>
    </div>
  );
}
