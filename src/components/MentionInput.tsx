import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  filterMentionCandidates,
  mentionTokenForUser,
  MENTION_EVERYONE,
  splitMentionText,
  isXPostUrl,
  extractXPostId,
  type MentionUser,
} from "@shared/chat-mentions";

type MentionUserOption = MentionUser & { displayName?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
  isAdmin?: boolean;
  users: MentionUserOption[];
  multiline?: boolean;
  className?: string;
};

type ActiveMention = {
  atIndex: number;
  query: string;
};

function getActiveMention(value: string, cursor: number): ActiveMention | null {
  const before = value.slice(0, cursor);
  const match = before.match(/@([^\n@]*)$/);
  if (!match) return null;
  return {
    atIndex: before.length - match[0].length,
    query: match[1],
  };
}

export function MentionInput({
  value,
  onChange,
  maxLength,
  placeholder,
  disabled,
  isAdmin = false,
  users,
  multiline = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeMention = useMemo(
    () => getActiveMention(value, cursor),
    [value, cursor],
  );

  const suggestions = useMemo(() => {
    if (!activeMention) return [];
    return filterMentionCandidates(users, activeMention.query, isAdmin);
  }, [activeMention, users, isAdmin]);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeMention?.query, suggestions.length]);

  const applyMention = useCallback(
    (token: string) => {
      if (!activeMention) return;
      const before = value.slice(0, activeMention.atIndex);
      const after = value.slice(cursor);
      const next = `${before}${token} ${after}`.slice(0, maxLength);
      onChange(next);
      const nextCursor = before.length + token.length + 1;
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      });
    },
    [activeMention, cursor, maxLength, onChange, value],
  );

  const pickSuggestion = useCallback(
    (index: number) => {
      const item = suggestions[index];
      if (!item) return;
      if ("label" in item && item.id === MENTION_EVERYONE) {
        applyMention(`@${MENTION_EVERYONE}`);
        return;
      }
      applyMention(mentionTokenForUser(item as MentionUser));
    },
    [applyMention, suggestions],
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!activeMention || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pickSuggestion(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCursor(activeMention.atIndex);
    }
  }

  const sharedProps = {
    ref: inputRef as never,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value.slice(0, maxLength));
      setCursor(e.target.selectionStart ?? 0);
    },
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setCursor((e.target as HTMLInputElement).selectionStart ?? 0);
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setCursor((e.target as HTMLInputElement).selectionStart ?? 0);
    },
    onKeyDown: handleKeyDown,
    placeholder,
    disabled,
    maxLength,
    className,
  };

  return (
    <div className="relative min-w-0 flex-1">
      {multiline ? (
        <textarea {...sharedProps} rows={2} />
      ) : (
        <input type="text" {...sharedProps} />
      )}

      {activeMention && suggestions.length > 0 && (
        <ul
          className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/15 bg-[#121a2a] py-1 shadow-xl"
          role="listbox"
        >
          {suggestions.map((item, index) => {
            const isEveryone = "label" in item && item.id === MENTION_EVERYONE;
            const label = isEveryone
              ? item.label
              : mentionTokenForUser(item as MentionUser);
            const sub = isEveryone
              ? "Powiadom wszystkich graczy"
              : `@${(item as MentionUser).nickname}`;

            return (
              <li key={isEveryone ? MENTION_EVERYONE : item.id} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(index)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition ${
                    index === activeIndex
                      ? "bg-[var(--wc-gold)]/15 text-white"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-white/45">{sub}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function XPostEmbed({ url }: { url: string }) {
  const postId = extractXPostId(url);
  if (!postId) return null;

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <iframe
        src={`https://platform.twitter.com/embed/Tweet.html?id=${postId}&theme=dark`}
        className="w-full border-0"
        style={{ minHeight: "200px", maxHeight: "400px" }}
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
        title="Post z platformy X"
      />
    </div>
  );
}

function LinkPreview({ url }: { url: string }) {
  let displayUrl: string;
  try {
    const parsed = new URL(url);
    displayUrl = parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
    if (displayUrl.length > 50) displayUrl = displayUrl.slice(0, 47) + "…";
  } catch {
    displayUrl = url;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300 hover:decoration-sky-300/60 break-all"
      title={url}
    >
      {displayUrl}
    </a>
  );
}

export function MentionText({ text }: { text: string }) {
  const parts = splitMentionText(text);
  const xLinks = parts.filter((p) => p.type === "link" && isXPostUrl(p.value));

  return (
    <>
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <span key={index} className="font-semibold text-sky-300">
            {part.value}
          </span>
        ) : part.type === "link" ? (
          <LinkPreview key={index} url={part.value} />
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
      {xLinks.length > 0 && xLinks.map((link, index) => (
        <XPostEmbed key={`x-${index}`} url={link.value} />
      ))}
    </>
  );
}
