import { getDisplayName, type UserNameFields } from "./user-display.js";

export const MENTION_EVERYONE = "wszyscy";

export type MentionUser = UserNameFields & { id: string };

export function mentionTokenForUser(user: UserNameFields): string {
  return `@${getDisplayName(user)}`;
}

export function resolveMentionedUserIds(
  text: string,
  users: MentionUser[],
  senderId: string,
  senderIsAdmin: boolean,
): { userIds: string[]; error?: string } {
  const everyoneMatch = text.match(/@wszyscy\b/i);
  if (everyoneMatch) {
    if (!senderIsAdmin) {
      return { userIds: [], error: "Tylko administrator może używać @wszyscy" };
    }
    return {
      userIds: users.filter((u) => u.id !== senderId).map((u) => u.id),
    };
  }

  const mentioned = new Set<string>();
  const sorted = [...users].sort(
    (a, b) => getDisplayName(b).length - getDisplayName(a).length,
  );

  let masked = text;
  for (const user of sorted) {
    const token = mentionTokenForUser(user);
    if (!masked.includes(token)) continue;
    if (user.id !== senderId) mentioned.add(user.id);
    masked = masked.split(token).join("\u0000");
  }

  return { userIds: [...mentioned] };
}

export type MentionTextPart =
  | { type: "text"; value: string }
  | { type: "mention"; value: string }
  | { type: "link"; value: string };

const URL_REGEX = /https?:\/\/[^\s<>)"']+/gi;

/** Dzieli tekst na zwykły tekst i podświetlane @wzmianki. */
export function splitMentionText(text: string): MentionTextPart[] {
  const parts: MentionTextPart[] = [];
  const mentionRegex = /@(?:wszyscy|[\p{L}]+(?:\s+[\p{L}]+)*)/giu;
  let lastIndex = 0;

  for (const match of text.matchAll(mentionRegex)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    parts.push({ type: "mention", value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", value: text });
  }

  // Second pass: split text parts to detect URLs
  const result: MentionTextPart[] = [];
  for (const part of parts) {
    if (part.type !== "text") {
      result.push(part);
      continue;
    }
    let remaining = part.value;
    let urlMatch: RegExpExecArray | null;
    const urlRe = new RegExp(URL_REGEX.source, "gi");
    let partLastIndex = 0;

    while ((urlMatch = urlRe.exec(remaining)) !== null) {
      const idx = urlMatch.index;
      if (idx > partLastIndex) {
        result.push({ type: "text", value: remaining.slice(partLastIndex, idx) });
      }
      // Strip trailing punctuation that's likely not part of the URL
      let url = urlMatch[0];
      const trailingPunct = /[.,;:!?)]+$/.exec(url);
      if (trailingPunct) {
        url = url.slice(0, -trailingPunct[0].length);
        // Adjust regex lastIndex so punctuation isn't skipped
        urlRe.lastIndex -= trailingPunct[0].length;
      }
      result.push({ type: "link", value: url });
      partLastIndex = urlRe.lastIndex;
    }

    if (partLastIndex < remaining.length) {
      result.push({ type: "text", value: remaining.slice(partLastIndex) });
    }
  }

  return result.length > 0 ? result : [{ type: "text", value: text }];
}

/** Checks if a URL is an X/Twitter post link. */
export function isXPostUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^/]+\/status\/\d+/i.test(url);
}

/** Extracts the tweet/post ID from an X/Twitter URL. */
export function extractXPostId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function filterMentionCandidates(
  users: MentionUser[],
  query: string,
  includeEveryone: boolean,
): Array<MentionUser | { id: typeof MENTION_EVERYONE; label: string }> {
  const q = query.trim().toLowerCase();
  const results: Array<MentionUser | { id: typeof MENTION_EVERYONE; label: string }> = [];

  if (includeEveryone && MENTION_EVERYONE.startsWith(q)) {
    results.push({ id: MENTION_EVERYONE, label: `@${MENTION_EVERYONE}` });
  }

  for (const user of users) {
    const display = getDisplayName(user);
    const haystack = `${display} ${user.nickname}`.toLowerCase();
    if (!q || haystack.includes(q)) {
      results.push(user);
    }
  }

  return results.slice(0, 8);
}
