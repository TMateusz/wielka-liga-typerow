import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CornerDownRight,
  Crown,
  Heart,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
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
  rank: number | null;
};

type ChatParent = {
  id: string;
  authorName: string;
  text: string | null;
  deleted: boolean;
};

type ChatMessage = {
  id: string;
  text: string | null;
  deleted: boolean;
  parentId: string | null;
  parent: ChatParent | null;
  editedAt: string | null;
  createdAt: string;
  heartCount: number;
  heartedByMe: boolean;
  user: ChatUser;
};

type ChatResponse = {
  messages: ChatMessage[];
};

type MessageGroup = {
  userId: string;
  user: ChatUser;
  isMe: boolean;
  messages: ChatMessage[];
};

function chatLastSeenKey(userId: string): string {
  return `chat-last-seen-${userId}`;
}

function latestMessageTime(messages: ChatMessage[]): string | null {
  if (messages.length === 0) return null;
  return messages.reduce(
    (max, m) => (m.createdAt > max ? m.createdAt : max),
    messages[0].createdAt,
  );
}

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

function groupMessages(messages: ChatMessage[], currentUserId: string): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.userId === message.user.id) {
      last.messages.push(message);
    } else {
      groups.push({
        userId: message.user.id,
        user: message.user,
        isMe: message.user.id === currentUserId,
        messages: [message],
      });
    }
  }

  return groups;
}

function AuthorLabel({ user, isMe }: { user: ChatUser; isMe: boolean }) {
  const isLeader = user.rank === 1;

  return (
    <p className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-xs">
      {user.rank != null && (
        <span className="font-mono text-[11px] font-bold tracking-tight text-[var(--wc-gold)]">
          #{user.rank}
        </span>
      )}
      {isLeader && (
        <Crown
          className="h-3.5 w-3.5 shrink-0 fill-[var(--wc-gold)] text-[var(--wc-gold-light)] drop-shadow-[0_0_6px_rgba(212,175,55,0.55)]"
          aria-label="Lider rankingu"
          title="Lider rankingu"
        />
      )}
      <span
        className={`font-display text-sm font-bold tracking-wide ${
          isLeader ? "text-[var(--wc-gold-light)]" : isMe ? "text-[var(--wc-gold)]" : "text-white/90"
        }`}
      >
        {getDisplayName(user)}
      </span>
      {isMe && <span className="text-[10px] font-normal text-white/40">(Ty)</span>}
    </p>
  );
}

function ParentQuote({ parent }: { parent: ChatParent }) {
  return (
    <div className="mb-1.5 flex items-start gap-1.5 rounded-lg border-l-2 border-[var(--wc-gold)]/40 bg-black/20 px-2 py-1 text-[11px] text-white/50">
      <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--wc-gold)]/60" />
      <div className="min-w-0">
        <span className="font-medium text-white/65">{parent.authorName}</span>
        <p className="truncate text-white/45">
          {parent.deleted ? "Wiadomość usunięta" : parent.text}
        </p>
      </div>
    </div>
  );
}

export function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [heartingId, setHeartingId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  const isAdmin = user?.role === "ADMIN";

  const groups = useMemo(
    () => (user ? groupMessages(messages, user.id) : []),
    [messages, user],
  );

  const markAsRead = useCallback(
    (msgs: ChatMessage[]) => {
      if (!user) return;
      const latest = latestMessageTime(msgs) ?? new Date().toISOString();
      localStorage.setItem(chatLastSeenKey(user.id), latest);
      setHasUnread(false);
    },
    [user],
  );

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
    if (!open || !user) return;
    markAsRead(messages);
  }, [open, user, messages, markAsRead]);

  useEffect(() => {
    if (!user || open) return;

    const storageKey = chatLastSeenKey(user.id);

    async function checkUnread() {
      try {
        const data = await api<ChatResponse>("/chat");
        const stored = localStorage.getItem(storageKey);

        if (!stored) {
          const latest = latestMessageTime(data.messages);
          if (latest) localStorage.setItem(storageKey, latest);
          setHasUnread(false);
          return;
        }

        setHasUnread(data.messages.some((m) => m.createdAt > stored));
      } catch {
        // ignore background poll errors
      }
    }

    void checkUnread();
    const id = setInterval(() => void checkUnread(), CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (replyTo) setReplyTo(null);
        else if (editingId) {
          setEditingId(null);
          setEditDraft("");
        } else setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, replyTo, editingId]);

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

  function updateMessageInState(updated: ChatMessage) {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || editingId) return;

    setSending(true);
    setError("");
    try {
      const data = await api<{ message: ChatMessage }>("/chat", {
        method: "POST",
        body: JSON.stringify({
          text,
          parentId: replyTo?.id ?? undefined,
        }),
      });
      setDraft("");
      setReplyTo(null);
      shouldStickToBottom.current = true;
      setMessages((prev) => [...prev, data.message]);
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać wiadomości");
    } finally {
      setSending(false);
    }
  }

  async function handleEditSave(messageId: string) {
    const text = editDraft.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");
    try {
      const data = await api<{ message: ChatMessage }>(`/chat/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
      });
      updateMessageInState(data.message);
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać edycji");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(messageId: string) {
    if (deletingId) return;
    if (!window.confirm("Usunąć tę wiadomość?")) return;

    setDeletingId(messageId);
    setError("");
    try {
      await api(`/chat/${messageId}`, { method: "DELETE" });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deleted: true, text: null }
            : m,
        ),
      );
      if (editingId === messageId) {
        setEditingId(null);
        setEditDraft("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć wiadomości");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleHeart(message: ChatMessage) {
    if (message.deleted || heartingId) return;

    setHeartingId(message.id);
    const optimistic = !message.heartedByMe;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              heartedByMe: optimistic,
              heartCount: m.heartCount + (optimistic ? 1 : -1),
            }
          : m,
      ),
    );

    try {
      const data = await api<{ hearted: boolean; heartCount: number }>(
        `/chat/${message.id}/heart`,
        { method: "POST" },
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, heartedByMe: data.hearted, heartCount: data.heartCount }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                heartedByMe: message.heartedByMe,
                heartCount: message.heartCount,
              }
            : m,
        ),
      );
    } finally {
      setHeartingId(null);
    }
  }

  function startEdit(message: ChatMessage) {
    if (message.deleted || !message.text) return;
    setEditingId(message.id);
    setEditDraft(message.text);
    setReplyTo(null);
  }

  function startReply(message: ChatMessage) {
    if (message.deleted) return;
    setReplyTo(message);
    setEditingId(null);
    setEditDraft("");
  }

  function handleListScroll() {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottom.current = distanceFromBottom < 48;
  }

  function renderMessageBubble(message: ChatMessage, isMe: boolean, showHeader: boolean) {
    const canModify = isMe && !message.deleted;
    const isEditing = editingId === message.id;

    return (
      <article
        key={message.id}
        className={`group/msg relative rounded-xl px-3 py-2 ${
          isMe ? "bg-[var(--gold)]/10" : "bg-white/[0.06]"
        } ${showHeader ? "" : "mt-0.5"}`}
      >
        {showHeader && <AuthorLabel user={message.user} isMe={isMe} />}

        {message.parent && <ParentQuote parent={message.parent} />}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {!showHeader && (
              <span className="mb-0.5 block text-[10px] text-white/30">
                {formatMessageTime(message.createdAt)}
              </span>
            )}

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editDraft}
                  onChange={(e) =>
                    setEditDraft(e.target.value.slice(0, CHAT_MAX_MESSAGE_LENGTH))
                  }
                  rows={2}
                  className="w-full resize-none rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-[var(--wc-gold)]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEditSave(message.id)}
                    disabled={sending || !editDraft.trim()}
                    className="rounded-lg bg-[var(--wc-gold)]/20 px-2 py-1 text-xs font-medium text-[var(--wc-gold)] hover:bg-[var(--wc-gold)]/30"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft("");
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            ) : message.deleted ? (
              <p className="text-sm italic text-white/35">Wiadomość usunięta</p>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
                {message.text}
              </p>
            )}

            {showHeader && !isEditing && (
              <p className="mt-1 text-[10px] text-white/30">
                {formatMessageTime(message.createdAt)}
                {message.editedAt && (
                  <span className="ml-1.5 text-white/25">· edytowano</span>
                )}
              </p>
            )}
          </div>
        </div>

        {!isEditing && !message.deleted && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => void handleHeart(message)}
              disabled={heartingId === message.id}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] transition ${
                message.heartedByMe
                  ? "bg-red-500/15 text-red-300"
                  : "text-white/35 hover:bg-white/10 hover:text-red-300/80"
              }`}
              title={message.heartedByMe ? "Usuń serduszko" : "Daj serduszko"}
            >
              <Heart
                className={`h-3.5 w-3.5 ${message.heartedByMe ? "fill-current" : ""}`}
              />
              {message.heartCount > 0 && <span>{message.heartCount}</span>}
            </button>

            <button
              type="button"
              onClick={() => startReply(message)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] text-white/35 transition hover:bg-white/10 hover:text-white/70"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              Odpowiedz
            </button>

            {canModify && (
              <>
                <button
                  type="button"
                  onClick={() => startEdit(message)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] text-white/35 transition hover:bg-white/10 hover:text-white/70"
                >
                  <Pencil className="h-3 w-3" />
                  Edytuj
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(message.id)}
                  disabled={deletingId === message.id}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] text-white/35 transition hover:bg-red-500/15 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Usuń
                </button>
              </>
            )}

            {isAdmin && !isMe && (
              <button
                type="button"
                onClick={() => void handleDelete(message.id)}
                disabled={deletingId === message.id}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] text-white/35 transition hover:bg-red-500/15 hover:text-red-400"
                title="Usuń (admin)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </article>
    );
  }

  const panel = (
    <div
      className="flex h-full flex-col overflow-hidden border border-white/15 bg-[#0d111c]/98 shadow-2xl backdrop-blur-md sm:rounded-2xl"
      role="dialog"
      aria-label="Czat ligowy"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-wide text-[var(--wc-gold)]">
            Czat ligowy
          </h2>
          <p className="text-xs text-white/45">
            Ranking · odpowiedzi · reakcje · odświeżanie co 5 s
          </p>
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
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
      >
        {loading && messages.length === 0 ? (
          <p className="text-center text-sm text-white/40">Ładowanie wiadomości…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-white/40">
            Brak wiadomości — napisz pierwszą!
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={`${group.userId}-${group.messages[0]?.id}`} className="space-y-0.5">
                {group.messages.map((message, index) =>
                  renderMessageBubble(message, group.isMe, index === 0),
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="shrink-0 border-t border-white/10 p-3">
        {replyTo && (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-[var(--wc-gold)]/25 bg-[var(--wc-gold)]/5 px-3 py-2">
            <div className="min-w-0 text-xs">
              <p className="font-medium text-[var(--wc-gold)]">
                Odpowiedź dla {getDisplayName(replyTo.user)}
              </p>
              <p className="truncate text-white/50">
                {replyTo.deleted ? "Wiadomość usunięta" : replyTo.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="shrink-0 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
              aria-label="Anuluj odpowiedź"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_MESSAGE_LENGTH))}
            placeholder={replyTo ? "Napisz odpowiedź…" : "Napisz wiadomość…"}
            maxLength={CHAT_MAX_MESSAGE_LENGTH}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[var(--wc-gold)]"
            disabled={sending || !!editingId}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim() || !!editingId}
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
          className="fixed inset-0 z-[60] sm:inset-auto sm:bottom-20 sm:right-4 sm:left-auto sm:top-auto sm:h-[32rem] sm:w-[24rem]"
          aria-hidden={!open}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 sm:hidden"
            onClick={() => setOpen(false)}
            aria-label="Zamknij czat"
          />
          <div className="relative flex h-full flex-col sm:h-full sm:shadow-xl">{panel}</div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-4 z-[61] h-14 w-14 items-center justify-center rounded-full border border-[var(--wc-gold)]/40 bg-gradient-to-br from-[#1a2235] to-[#0d111c] text-[var(--wc-gold)] shadow-lg transition hover:scale-105 hover:border-[var(--wc-gold)]/70 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)] ${
          open ? "hidden sm:flex ring-2 ring-[var(--wc-gold)]/50" : "flex"
        }`}
        aria-label={
          open
            ? "Zamknij czat ligowy"
            : hasUnread
              ? "Otwórz czat ligowy — nowe wiadomości"
              : "Otwórz czat ligowy"
        }
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {hasUnread && !open && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold leading-none text-white shadow-md ring-2 ring-[#0d111c] animate-pulse"
            aria-hidden
          >
            !
          </span>
        )}
      </button>
    </>
  );
}
