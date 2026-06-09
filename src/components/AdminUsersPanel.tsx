import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, UserCog } from "lucide-react";
import { formatPoints } from "@shared/scoring";
import { api } from "../api/client";
import { getDisplayName } from "@shared/user-display";

type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  totalPoints: number;
  role: "USER" | "ADMIN";
  createdAt: string;
  _count: { predictions: number };
};

type Props = {
  onMessage: (msg: string) => void;
};

export function AdminUsersPanel({ onMessage }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const data = await api<AdminUser[]>("/admin/users");
    setUsers(data);
  }, []);

  useEffect(() => {
    loadUsers()
      .catch(() => onMessage("Nie udało się załadować listy graczy"))
      .finally(() => setLoading(false));
  }, [loadUsers, onMessage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${getDisplayName(u)} ${u.nickname}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  const playerCount = users.filter((u) => u.role === "USER").length;

  async function submitEdit(e: FormEvent<HTMLFormElement>, userId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    try {
      const updated = await api<AdminUser>(`/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: String(form.get("firstName")).trim(),
          lastName: String(form.get("lastName")).trim(),
          nickname: String(form.get("nickname")).trim(),
        }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setEditingId(null);
      onMessage(`Zaktualizowano konto @${updated.nickname}`);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Błąd zapisu gracza");
    }
  }

  async function deleteUser(user: AdminUser) {
    const label = getDisplayName(user);
    if (!window.confirm(`Usunąć gracza ${label} (@${user.nickname})? Typy zostaną skasowane.`)) {
      return;
    }

    setDeletingId(user.id);
    try {
      await api(`/admin/users/${user.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      onMessage(`Usunięto gracza ${label}`);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Błąd usuwania gracza");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-white/60">Ładowanie graczy…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/50">
          {playerCount} graczy · edycja nicków, imion i usuwanie kont
        </p>
        <input
          type="search"
          placeholder="Szukaj gracza…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm outline-none focus:border-[var(--gold)]"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-white/50">Brak graczy pasujących do wyszukiwania.</p>
        )}

        {filtered.map((u) => {
          const isEditing = editingId === u.id;
          const isAdmin = u.role === "ADMIN";

          return (
            <div key={u.id} className="card-pitch space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <UserCog className="h-4 w-4 text-[var(--gold)]" />
                    {getDisplayName(u)}
                    {isAdmin && (
                      <span className="rounded bg-[var(--gold)]/20 px-2 py-0.5 text-xs text-[var(--gold)]">
                        Admin
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-white/50">
                    @{u.nickname} · {formatPoints(u.totalPoints)} pkt · {u._count.predictions} typów
                  </p>
                  <p className="text-xs text-white/35">
                    Dołączył: {new Date(u.createdAt).toLocaleString("pl-PL")}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(isEditing ? null : u.id)}
                    className="btn-ghost text-sm"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {isEditing ? "Anuluj" : "Edytuj"}
                  </button>
                  {!isAdmin && (
                    <button
                      type="button"
                      disabled={deletingId === u.id}
                      onClick={() => void deleteUser(u)}
                      className="btn-ghost text-sm text-red-300 hover:border-red-400/40 hover:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Usuń
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <form
                  onSubmit={(e) => submitEdit(e, u.id)}
                  className="grid gap-3 rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="mb-1 block text-xs text-white/50">Imię</label>
                    <input
                      name="firstName"
                      defaultValue={u.firstName}
                      required
                      minLength={2}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/50">Nazwisko</label>
                    <input
                      name="lastName"
                      defaultValue={u.lastName}
                      required
                      minLength={2}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-white/50">Nick (login)</label>
                    <input
                      name="nickname"
                      defaultValue={u.nickname}
                      required
                      minLength={3}
                      maxLength={20}
                      pattern="[a-zA-Z0-9_]{3,20}"
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button type="submit" className="btn-primary">
                      Zapisz zmiany
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
