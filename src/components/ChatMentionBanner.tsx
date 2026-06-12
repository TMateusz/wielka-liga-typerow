import { MessageCircle } from "lucide-react";
import { useChat } from "../contexts/ChatContext";

export function ChatMentionBanner() {
  const { unreadMentions, openChat } = useChat();

  if (unreadMentions <= 0) return null;

  return (
    <button
      type="button"
      onClick={() => void openChat()}
      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-400 bg-red-600 px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_0_24px_rgba(220,38,38,0.45)] transition hover:bg-red-500 active:scale-[0.99] sm:text-base"
    >
      <MessageCircle className="h-5 w-5 shrink-0" />
      Ktoś cię wzmiankował na czacie
    </button>
  );
}
