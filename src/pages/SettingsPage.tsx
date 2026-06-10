import { FormEvent, useEffect, useState } from "react";
import { Bell, KeyRound, Mail } from "lucide-react";
import { getDisplayName } from "@shared/user-display";
import { api } from "../api/client";
import { useAuth, type User } from "../contexts/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<User | null>(user);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    api<User>("/auth/me")
      .then(setProfile)
      .catch(() => setProfile(user));
  }, [user]);

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const emailRemindersEnabled = form.get("emailRemindersEnabled") === "on";

    try {
      const updated = await api<User>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ email, emailRemindersEnabled }),
      });
      setProfile(updated);
      setProfileSuccess("Ustawienia e-mail zostały zapisane.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Nie udało się zapisać ustawień");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);

    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword"));
    const newPassword = String(form.get("newPassword"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (newPassword !== confirmPassword) {
      setPasswordError("Nowe hasła nie są identyczne");
      setPasswordLoading(false);
      return;
    }

    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordSuccess("Hasło zostało zmienione.");
      e.currentTarget.reset();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Nie udało się zmienić hasła");
    } finally {
      setPasswordLoading(false);
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

      <form onSubmit={handleProfileSubmit} className="card-pitch flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-[var(--gold)]">
          <Mail className="h-5 w-5" />
          <h3 className="font-semibold">E-mail i przypomnienia</h3>
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Adres e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={profile?.email ?? ""}
            key={profile?.email ?? "empty"}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 outline-none focus:border-[var(--gold)]"
            placeholder="jan@example.com"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <input
            type="checkbox"
            name="emailRemindersEnabled"
            defaultChecked={profile?.emailRemindersEnabled !== false}
            key={profile?.emailRemindersEnabled ? "on" : "off"}
            className="mt-1 h-4 w-4 rounded border-white/30"
          />
          <span>
            <span className="flex items-center gap-1.5 font-medium">
              <Bell className="h-4 w-4 text-[var(--gold)]" />
              Przypomnienia przed meczem
            </span>
            <span className="mt-1 block text-sm text-white/55">
              E-mail ~8 godzin przed startem, jeśli nie masz typu na dany mecz
            </span>
          </span>
        </label>

        {profileError && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{profileError}</p>
        )}

        {profileSuccess && (
          <p className="rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-200">{profileSuccess}</p>
        )}

        <button type="submit" disabled={profileLoading} className="btn-primary w-full">
          {profileLoading ? "Zapisywanie…" : "Zapisz e-mail"}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="card-pitch flex flex-col gap-4 p-6">
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

        {passwordError && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{passwordError}</p>
        )}

        {passwordSuccess && (
          <p className="rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-200">{passwordSuccess}</p>
        )}

        <button type="submit" disabled={passwordLoading} className="btn-primary w-full">
          {passwordLoading ? "Zapisywanie…" : "Zmień hasło"}
        </button>
      </form>
    </div>
  );
}
