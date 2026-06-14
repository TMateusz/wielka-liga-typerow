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
import type { MentionUser } from "@shared/chat-mentions";
import { api } from "../api/client";
import { MentionInput, MentionText } from "./MentionInput";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";

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

type MentionUsersResponse = {
  users: Array<MentionUser & { displayName: string }>;
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

const STACK_GAP_MS = 5 * 60 * 1000;

function canStackMessages(prev: ChatMessage, next: ChatMessage): boolean {
  if (prev.user.id !== next.user.id) return false;
  if (next.parentId || prev.parentId) return false;
  if (prev.deleted || next.deleted) return false;
  const gap = new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return gap >= 0 && gap <= STACK_GAP_MS;
}

function groupMessages(messages: ChatMessage[], currentUserId: string): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const last = groups[groups.length - 1];
    const lastMessage = last?.messages[last.messages.length - 1];

    if (last && lastMessage && canStackMessages(lastMessage, message)) {
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
        <span className="font-mono text-sm font-bold tracking-tight text-[var(--wc-gold)]">
          #{user.rank}
        </span>
      )}
      {isLeader && (
        <span title="Lider rankingu">
          <Crown
            className="h-3.5 w-3.5 shrink-0 fill-[var(--wc-gold)] text-[var(--wc-gold-light)] drop-shadow-[0_0_6px_rgba(212,175,55,0.55)]"
            aria-label="Lider rankingu"
          />
        </span>
      )}
      <span
        className={`text-sm font-normal tracking-wide ${
          isLeader ? "text-[var(--wc-gold-light)]" : isMe ? "text-[var(--wc-gold)]/90" : "text-white/75"
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
  const { open, setOpen, unreadMentions, refreshUnreadMentions } = useChat();
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
  const [mentionUsers, setMentionUsers] = useState<MentionUsersResponse["users"]>([]);
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
    void api<MentionUsersResponse>("/chat/users")
      .then((data) => setMentionUsers(data.users))
      .catch(() => {});
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
      void refreshUnreadMentions();
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

  function renderMessageActions(message: ChatMessage, isMe: boolean) {
    const canModify = isMe && !message.deleted;
    if (message.deleted || editingId === message.id) return null;

    return (
      <div className="flex shrink-0 items-center gap-0.5 opacity-50 transition-opacity group-active/line:opacity-100 group-focus-within/line:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/line:opacity-100">
        <button
          type="button"
          onClick={() => void handleHeart(message)}
          disabled={heartingId === message.id}
          className={`rounded-md p-1 transition ${
            message.heartedByMe
              ? "text-red-300"
              : "text-white/40 hover:bg-white/10 hover:text-red-300/80"
          }`}
          title={message.heartedByMe ? "Usuń serduszko" : "Daj serduszko"}
        >
          <Heart className={`h-3.5 w-3.5 ${message.heartedByMe ? "fill-current" : ""}`} />
        </button>

        <button
          type="button"
          onClick={() => startReply(message)}
          className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white/70"
          title="Odpowiedz"
        >
          <CornerDownRight className="h-3.5 w-3.5" />
        </button>

        {canModify && (
          <>
            <button
              type="button"
              onClick={() => startEdit(message)}
              className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white/70"
              title="Edytuj"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(message.id)}
              disabled={deletingId === message.id}
              className="rounded-md p-1 text-white/40 transition hover:bg-red-500/15 hover:text-red-400"
              title="Usuń"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {isAdmin && !isMe && (
          <button
            type="button"
            onClick={() => void handleDelete(message.id)}
            disabled={deletingId === message.id}
            className="rounded-md p-1 text-white/40 transition hover:bg-red-500/15 hover:text-red-400"
            title="Usuń (admin)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  function innerBubbleClass(isMe: boolean): string {
    return isMe
      ? "rounded-xl bg-[var(--wc-gold)]/10 px-2.5 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.28)] ring-1 ring-[var(--wc-gold)]/10"
      : "rounded-xl bg-black/25 px-2.5 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.35)] ring-1 ring-white/8";
  }

  function renderMessageLine(message: ChatMessage, isMe: boolean, segmented: boolean) {
    const isEditing = editingId === message.id;

    return (
      <div key={message.id} className="group/line">
        {message.parent && <ParentQuote parent={message.parent} />}

        {isEditing ? (
          <div className="space-y-2">
            <MentionInput
              value={editDraft}
              onChange={setEditDraft}
              maxLength={CHAT_MAX_MESSAGE_LENGTH}
              users={mentionUsers}
              isAdmin={isAdmin}
              multiline
              className="w-full resize-none rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-[var(--wc-gold)]"
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
        ) : (
          <div
            className={`flex items-start justify-between gap-1 ${
              segmented ? innerBubbleClass(isMe) : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              {message.deleted ? (
                <p className="text-sm italic text-white/35">Wiadomość usunięta</p>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-snug text-white/90">
                  <MentionText text={message.text ?? ""} />
                  {message.heartCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-red-300/90">
                      <Heart className="h-2.5 w-2.5 fill-current" />
                      {message.heartCount}
                    </span>
                  )}
                </p>
              )}
            </div>
            {renderMessageActions(message, isMe)}
          </div>
        )}
      </div>
    );
  }

  function renderMessageGroup(group: MessageGroup) {
    const lastMessage = group.messages[group.messages.length - 1];
    const segmented = group.messages.length > 1;

    return (
      <article
        key={`${group.userId}-${group.messages[0]?.id}`}
        className={`max-w-[92%] rounded-2xl px-3 py-2 ${
          group.isMe
            ? "ml-auto bg-[var(--gold)]/12"
            : "mr-auto bg-white/[0.07]"
        }`}
      >
        <AuthorLabel user={group.user} isMe={group.isMe} />

        <div className={segmented ? "space-y-1.5" : ""}>
          {group.messages.map((message) =>
            renderMessageLine(message, group.isMe, segmented),
          )}
        </div>

        {lastMessage && editingId !== lastMessage.id && (
          <p className="mt-0.5 text-[10px] text-white/28">
            {formatMessageTime(lastMessage.createdAt)}
            {lastMessage.editedAt && (
              <span className="ml-1 text-white/22">· edytowano</span>
            )}
          </p>
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
          <div className="flex flex-col gap-2">
            {groups.map((group) => renderMessageGroup(group))}
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
          <MentionInput
            value={draft}
            onChange={setDraft}
            maxLength={CHAT_MAX_MESSAGE_LENGTH}
            placeholder={replyTo ? "Napisz odpowiedź… (@ aby wspomnieć)" : "Napisz wiadomość… (@ aby wspomnieć)"}
            disabled={sending || !!editingId}
            users={mentionUsers}
            isAdmin={isAdmin}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[var(--wc-gold)]"
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
          className="fixed inset-0 z-[60] sm:inset-auto sm:bottom-20 sm:right-4 sm:left-auto sm:top-auto sm:h-[36rem] sm:w-[28rem]"
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
        onClick={() => setOpen(!open)}
        className={`fixed bottom-4 right-4 z-[61] h-14 w-14 items-center justify-center rounded-full border border-[var(--wc-gold)]/40 bg-gradient-to-br from-[#1a2235] to-[#0d111c] text-[var(--wc-gold)] shadow-lg transition hover:scale-105 hover:border-[var(--wc-gold)]/70 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)] ${
          open ? "hidden sm:flex ring-2 ring-[var(--wc-gold)]/50" : "flex"
        }`}
        aria-label={
          open
            ? "Zamknij czat ligowy"
            : hasUnread || unreadMentions > 0
              ? "Otwórz czat ligowy — nowe wiadomości"
              : "Otwórz czat ligowy"
        }
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {(hasUnread || unreadMentions > 0) && !open && (
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
