import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { WcBrandMark } from "../components/WcBrandMark";
import { api } from "../api/client";

type RegistrationInfo = {
  requiresCode: boolean;
  maxPlayers: number | null;
  playerCount: number;
  slotsLeft: number | null;
  open: boolean;
};

export default function RegisterPage() {
  const { register } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [regInfo, setRegInfo] = useState<RegistrationInfo | null>(null);

  useEffect(() => {
    api<RegistrationInfo>("/auth/registration-info")
      .then(setRegInfo)
      .catch(() => setRegInfo(null));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne");
      setLoading(false);
      return;
    }

    try {
      await register({
        firstName: String(form.get("firstName")).trim(),
        lastName: String(form.get("lastName")).trim(),
        nickname: String(form.get("nickname")).trim(),
        email: String(form.get("email")).trim(),
        password,
        inviteCode: regInfo?.requiresCode ? String(form.get("inviteCode")).trim() : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd rejestracji");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-2 sm:gap-8 sm:pt-4">
      <WcBrandMark size="lg" />

      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-wide text-white sm:text-4xl">
          Dołącz do ligi
        </h1>
        <p className="mt-2 text-white/60">
          Załóż konto i typuj wyniki MŚ 2026 razem z innymi graczami
        </p>
      </div>

      {regInfo && !regInfo.open && (
        <div className="card-pitch p-6 text-center">
          <p className="text-lg font-medium text-white">Rejestracja zamknięta</p>
          <p className="mt-2 text-sm text-white/60">
            Osiągnięto limit {regInfo.maxPlayers} graczy. Skontaktuj się z organizatorem ligi.
          </p>
          <p className="mt-4 text-sm text-white/50">
            Masz konto?{" "}
            <Link to="/login" className="font-medium text-[var(--wc-gold)] hover:underline">
              Zaloguj się
            </Link>
          </p>
        </div>
      )}

      {(!regInfo || regInfo.open) && (
      <form onSubmit={handleSubmit} className="card-pitch flex flex-col gap-4 p-6">
        {regInfo?.requiresCode && (
          <div>
            <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium text-white/80">
              Kod zaproszenia
            </label>
            <input
              id="inviteCode"
              name="inviteCode"
              required
              autoComplete="off"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
              placeholder="Kod od organizatora"
            />
          </div>
        )}

        {regInfo?.slotsLeft != null && regInfo.slotsLeft <= 20 && (
          <p className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/60">
            Wolnych miejsc: {regInfo.slotsLeft}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-white/80">
              Imię
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              minLength={2}
              autoComplete="given-name"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
              placeholder="Jan"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-white/80">
              Nazwisko
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              minLength={2}
              autoComplete="family-name"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
              placeholder="Kowalski"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-white/80">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
            placeholder="jan@example.com"
          />
          <p className="mt-1 text-xs text-white/40">
            Wyślemy przypomnienie ~8h przed meczem, jeśli nie obstawisz wyniku
          </p>
        </div>

        <div>
          <label htmlFor="nickname" className="mb-1 block text-sm font-medium text-white/80">
            Nick (login)
          </label>
          <input
            id="nickname"
            name="nickname"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]{3,20}"
            autoComplete="username"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
            placeholder="jan_k"
          />
          <p className="mt-1 text-xs text-white/40">3–20 znaków: litery, cyfry, podkreślnik</p>
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-white/80">
            Hasło
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={4}
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-white/80">
            Powtórz hasło
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={4}
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Tworzenie konta…" : "Zarejestruj się"}
        </button>

        <p className="text-center text-sm text-white/50">
          Masz już konto?{" "}
          <Link to="/login" className="font-medium text-[var(--wc-gold)] hover:underline">
            Zaloguj się
          </Link>
        </p>
      </form>
      )}
    </div>
  );
}
