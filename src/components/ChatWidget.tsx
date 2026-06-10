import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { CHAT_MAX_MESSAGE_LENGTH, CHAT_POLL_INTERVAL_MS } from "@shared/chat-limits";
import { getDisplayName } from "@shared/display-names";
import { formatLastActive } from "@shared/relative-time";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

type ChatUser = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  role: "USER" | "ADMIN";
};

type ChatMessage = {
  id: string;
  text: string;
  createdAt: string;
  user: ChatUser;
};

type ChatResponse = {
  messages: ChatMessage[];
};

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return formatLastActive(iso, now);
}

export function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  const isAdmin = user?.role === "ADMIN";

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api<ChatResponse>("/chat");
      setMessages(data.messages);
      setError("");
      if (shouldStickToBottom.current) {
        requestAnimationFrame(() => scrollToBottom(silent ? "auto" : "smooth"));
      }
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Nie udało się załadować czatu");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (!open || !user) return;

    void loadMessages();
    const id = setInterval(() => void loadMessages(true), CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [open, user, loadMessages]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = window.matchMedia("(max-width: 639px)").matches
        ? "hidden"
        : "";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!user) return null;

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");
    try {
      const data = await api<{ message: ChatMessage }>("/chat", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setDraft("");
      shouldStickToBottom.current = true;
      setMessages((prev) => [...prev, data.message]);
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać wiadomości");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(messageId: string) {
    if (!isAdmin || deletingId) return;
    if (!window.confirm("Usunąć tę wiadomość z czatu?")) return;

    setDeletingId(messageId);
    setError("");
    try {
      await api(`/chat/${messageId}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć wiadomości");
    } finally {
      setDeletingId(null);
    }
  }

  function handleListScroll() {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottom.current = distanceFromBottom < 48;
  }

  const panel = (
    <div
      className="flex h-full flex-col overflow-hidden border border-white/15 bg-[#0d111c]/98 shadow-2xl backdrop-blur-md sm:rounded-2xl"
      role="dialog"
      aria-label="Czat ligowy"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="font-semibold text-[var(--wc-gold)]">Czat ligowy</h2>
          <p className="text-xs text-white/45">Tylko dla zalogowanych · odświeżanie co 5 s</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Zamknij czat"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        {loading && messages.length === 0 ? (
          <p className="text-center text-sm text-white/40">Ładowanie wiadomości…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-white/40">
            Brak wiadomości — napisz pierwszą!
          </p>
        ) : (
          messages.map((message) => {
            const isMe = message.user.id === user.id;
            return (
              <article
                key={message.id}
                className={`group rounded-xl px-3 py-2 ${
                  isMe ? "bg-[var(--gold)]/10" : "bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white/70">
                      <span className={isMe ? "text-[var(--wc-gold)]" : "text-white/85"}>
                        {getDisplayName(message.user)}
                      </span>
                      {isMe && <span className="ml-1 text-white/40">(Ty)</span>}
                      <span className="ml-2 text-white/35">
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/90">
                      {message.text}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(message.id)}
                      disabled={deletingId === message.id}
                      className="shrink-0 rounded p-1 text-white/30 opacity-100 hover:bg-red-500/20 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Usuń wiadomość"
                      title="Usuń wiadomość (admin)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-white/10 p-3"
      >
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_MESSAGE_LENGTH))}
            placeholder="Napisz wiadomość…"
            maxLength={CHAT_MAX_MESSAGE_LENGTH}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--wc-gold)]"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="btn-primary shrink-0 px-3"
            aria-label="Wyślij"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-right text-[10px] text-white/30">
          {draft.length}/{CHAT_MAX_MESSAGE_LENGTH}
        </p>
      </form>
    </div>
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] sm:inset-auto sm:bottom-20 sm:right-4 sm:left-auto sm:top-auto sm:h-[28rem] sm:w-[22rem]"
          aria-hidden={!open}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 sm:hidden"
            onClick={() => setOpen(false)}
            aria-label="Zamknij czat"
          />
          <div className="relative flex h-full flex-col sm:h-full sm:shadow-xl">
            {panel}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-4 z-[61] flex h-14 w-14 items-center justify-center rounded-full border border-[var(--wc-gold)]/40 bg-gradient-to-br from-[#1a2235] to-[#0d111c] text-[var(--wc-gold)] shadow-lg transition hover:scale-105 hover:border-[var(--wc-gold)]/70 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)] ${
          open ? "ring-2 ring-[var(--wc-gold)]/50" : ""
        }`}
        aria-label={open ? "Zamknij czat ligowy" : "Otwórz czat ligowy"}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
