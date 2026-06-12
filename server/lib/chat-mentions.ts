import { UserRole } from "@prisma/client";
import { resolveMentionedUserIds, type MentionUser } from "../../shared/chat-mentions.js";
import { prisma } from "./prisma.js";

export async function loadMentionUsers(): Promise<MentionUser[]> {
  return prisma.user.findMany({
    where: { role: UserRole.USER },
    select: { id: true, firstName: true, lastName: true, nickname: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function syncMessageMentions(
  messageId: string,
  text: string,
  senderId: string,
  senderIsAdmin: boolean,
): Promise<string | null> {
  const users = await loadMentionUsers();
  const { userIds, error } = resolveMentionedUserIds(text, users, senderId, senderIsAdmin);
  if (error) return error;

  await prisma.chatMention.deleteMany({ where: { messageId } });

  if (userIds.length > 0) {
    await prisma.chatMention.createMany({
      data: userIds.map((userId) => ({ messageId, userId })),
    });
  }

  return null;
}

export async function countUnreadMentions(userId: string): Promise<number> {
  return prisma.chatMention.count({
    where: { userId, readAt: null },
  });
}

export async function markMentionsRead(userId: string): Promise<void> {
  await prisma.chatMention.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
