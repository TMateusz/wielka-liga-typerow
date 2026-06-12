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
  | { type: "mention"; value: string };

/** Dzieli tekst na zwykły tekst i podświetlane @wzmianki. */
export function splitMentionText(text: string): MentionTextPart[] {
  const parts: MentionTextPart[] = [];
  const regex = /@(?:wszyscy|[\p{L}]+(?:\s+[\p{L}]+)*)/giu;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
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

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
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
