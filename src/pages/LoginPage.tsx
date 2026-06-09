import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { WcBrandMark } from "../components/WcBrandMark";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    try {
      await login(String(form.get("nickname")), String(form.get("password")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd logowania");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-2 sm:gap-8 sm:pt-4">
      <WcBrandMark size="lg" />

      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-wide text-white sm:text-4xl">
          Wielka Liga Typerów
        </h1>
        <p className="mt-2 text-white/60">
          Typuj wyniki Mistrzostw Świata 2026 — dołącz do ligi i rywalizuj z innymi
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card-pitch flex flex-col gap-4 p-6">
        <div>
          <label htmlFor="nickname" className="mb-1 block text-sm font-medium text-white/80">
            Nick
          </label>
          <input
            id="nickname"
            name="nickname"
            required
            autoComplete="username"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
            placeholder="np. jan_k"
          />
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
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 outline-none transition focus:border-[var(--wc-gold)] focus:bg-white/10"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Logowanie…" : "Zaloguj się"}
        </button>

        <p className="text-center text-sm text-white/50">
          Nie masz konta?{" "}
          <Link to="/register" className="font-medium text-[var(--wc-gold)] hover:underline">
            Zarejestruj się
          </Link>
        </p>
      </form>

      <p className="text-center text-sm text-white/50">
        <Link to="/leaderboard" className="font-medium text-[var(--wc-gold)] hover:underline">
          Zobacz ranking bez logowania
        </Link>
      </p>

      <p className="text-center text-xs text-white/35">
        104 mecze · 48 reprezentacji · 16 miast gospodarzy
      </p>
    </div>
  );
}
