import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { getDisplayName } from "@shared/user-display";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword"));
    const newPassword = String(form.get("newPassword"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (newPassword !== confirmPassword) {
      setError("Nowe hasła nie są identyczne");
      setLoading(false);
      return;
    }

    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSuccess("Hasło zostało zmienione.");
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić hasła");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ustawienia konta</h2>
        <p className="text-white/60">
          Zalogowany jako{" "}
          <span className="text-white">{user ? getDisplayName(user) : ""}</span> (@{user?.nickname})
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card-pitch flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-[var(--gold)]">
          <KeyRound className="h-5 w-5" />
          <h3 className="font-semibold">Zmiana hasła</h3>
        </div>

        <div>
          <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium">
            Obecne hasło
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 outline-none focus:border-[var(--gold)]"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium">
            Nowe hasło
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={4}
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 outline-none focus:border-[var(--gold)]"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
            Powtórz nowe hasło
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={4}
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 outline-none focus:border-[var(--gold)]"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        {success && (
          <p className="rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-200">{success}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Zapisywanie…" : "Zmień hasło"}
        </button>
      </form>
    </div>
  );
}
