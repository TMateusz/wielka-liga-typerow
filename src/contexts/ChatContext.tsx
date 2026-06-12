import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CHAT_POLL_INTERVAL_MS } from "@shared/chat-limits";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

type ChatContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openChat: () => Promise<void>;
  unreadMentions: number;
  refreshUnreadMentions: () => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpenState] = useState(false);
  const [unreadMentions, setUnreadMentions] = useState(0);

  const refreshUnreadMentions = useCallback(async () => {
    if (!user) {
      setUnreadMentions(0);
      return;
    }
    try {
      const data = await api<{ count: number }>("/chat/mentions/unread");
      setUnreadMentions(data.count);
    } catch {
      // ignore background errors
    }
  }, [user]);

  const markMentionsRead = useCallback(async () => {
    if (!user) return;
    try {
      await api("/chat/mentions/read", { method: "POST" });
      setUnreadMentions(0);
    } catch {
      // ignore
    }
  }, [user]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (next) void markMentionsRead();
    },
    [markMentionsRead],
  );

  const openChat = useCallback(async () => {
    setOpenState(true);
    await markMentionsRead();
  }, [markMentionsRead]);

  useEffect(() => {
    if (!user) {
      setUnreadMentions(0);
      return;
    }

    void refreshUnreadMentions();
    const id = setInterval(() => void refreshUnreadMentions(), CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, refreshUnreadMentions]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openChat,
      unreadMentions,
      refreshUnreadMentions,
    }),
    [open, setOpen, openChat, unreadMentions, refreshUnreadMentions],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return ctx;
}
