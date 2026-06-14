import { Router } from "express";
import {
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_PARENT_PREVIEW_LENGTH,
} from "../../shared/chat-limits.js";
import { getDisplayName } from "../../shared/display-names.js";
import { resolveMentionedUserIds } from "../../shared/chat-mentions.js";
import {
  countUnreadMentions,
  loadMentionUsers,
  markMentionsRead,
  syncMessageMentions,
} from "../lib/chat-mentions.js";
import { prisma } from "../lib/prisma.js";
import { rateLimit } from "../lib/rate-limit.js";
import { buildUserRankMap } from "../lib/user-ranking.js";
import { scheduleActivityReward } from "../lib/activity-side-effects.js";
import { rewardChatHeart, rewardChatMessage, rewardOnlineSession } from "../lib/virtual-token-rewards.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const sendLimit = rateLimit({
  windowMs: 10_000,
  max: 4,
  message: "Za dużo wiadomości — odczekaj chwilę",
});

const actionLimit = rateLimit({
  windowMs: 10_000,
  max: 30,
  message: "Za dużo akcji — odczekaj chwilę",
});

type MessageRow = {
  id: string;
  text: string;
  parentId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    nickname: string;
    role: "USER" | "ADMIN";
  };
  parent: {
    id: string;
    text: string;
    deletedAt: Date | null;
    user: {
      firstName: string;
      lastName: string;
      nickname: string;
    };
  } | null;
  hearts: { userId: string }[];
};

function serializeParent(
  parent: MessageRow["parent"],
): {
  id: string;
  authorName: string;
  text: string | null;
  deleted: boolean;
} | null {
  if (!parent) return null;
  const deleted = parent.deletedAt != null;
  return {
    id: parent.id,
    authorName: getDisplayName(parent.user),
    text: deleted ? null : parent.text.slice(0, CHAT_PARENT_PREVIEW_LENGTH),
    deleted,
  };
}

function serializeMessage(
  message: MessageRow,
  rankMap: Map<string, number>,
  viewerUserId: string,
) {
  const deleted = message.deletedAt != null;
  const heartUserIds = message.hearts.map((h) => h.userId);

  return {
    id: message.id,
    text: deleted ? null : message.text,
    deleted,
    parentId: message.parentId,
    parent: serializeParent(message.parent),
    editedAt: message.editedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    heartCount: heartUserIds.length,
    heartedByMe: heartUserIds.includes(viewerUserId),
    user: {
      id: message.user.id,
      firstName: message.user.firstName,
      lastName: message.user.lastName,
      nickname: message.user.nickname,
      role: message.user.role,
      rank: rankMap.get(message.user.id) ?? null,
    },
  };
}

const messageSelect = {
  id: true,
  text: true,
  parentId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      role: true,
    },
  },
  parent: {
    select: {
      id: true,
      text: true,
      deletedAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          nickname: true,
        },
      },
    },
  },
  hearts: {
    select: { userId: true },
  },
} as const;

function validateText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length > CHAT_MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}

router.get("/users", requireAuth, async (_req, res) => {
  const users = await loadMentionUsers();
  res.json({
    users: users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      nickname: u.nickname,
      displayName: getDisplayName(u),
    })),
  });
});

router.get("/mentions/unread", requireAuth, async (req, res) => {
  const count = await countUnreadMentions(req.user!.id);
  res.json({ count });
});

router.post("/mentions/read", requireAuth, async (req, res) => {
  await markMentionsRead(req.user!.id);
  res.json({ ok: true });
});

router.get("/", requireAuth, async (req, res) => {
  const [messages, rankMap] = await Promise.all([
    prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: CHAT_HISTORY_LIMIT,
      select: messageSelect,
    }),
    buildUserRankMap(),
  ]);

  res.json({
    messages: messages
      .reverse()
      .map((m) => serializeMessage(m as MessageRow, rankMap, req.user!.id)),
  });
});

router.post("/", requireAuth, sendLimit, async (req, res) => {
  const text = validateText(req.body.text);
  if (!text) {
    return res.status(400).json({ error: "Wiadomość nie może być pusta" });
  }

  let parentId: string | null = null;
  if (req.body.parentId != null) {
    if (typeof req.body.parentId !== "string") {
      return res.status(400).json({ error: "Nieprawidłowa odpowiedź" });
    }
    const parent = await prisma.chatMessage.findUnique({
      where: { id: req.body.parentId },
      select: { id: true },
    });
    if (!parent) {
      return res.status(404).json({ error: "Wiadomość, na którą odpowiadasz, nie istnieje" });
    }
    parentId = parent.id;
  }

  const mentionUsers = await loadMentionUsers();
  const { error: mentionError } = resolveMentionedUserIds(
    text,
    mentionUsers,
    req.user!.id,
    req.user!.role === "ADMIN",
  );
  if (mentionError) {
    return res.status(400).json({ error: mentionError });
  }

  const rankMap = await buildUserRankMap();
  const message = await prisma.chatMessage.create({
    data: {
      userId: req.user!.id,
      text,
      parentId,
    },
    select: messageSelect,
  });

  await syncMessageMentions(message.id, text, req.user!.id, req.user!.role === "ADMIN");

  // Push notification for mentioned users (best-effort, non-blocking)
  {
    const { userIds } = resolveMentionedUserIds(text, mentionUsers, req.user!.id, req.user!.role === "ADMIN");
    if (userIds.length > 0) {
      import("../lib/push-scheduler.js")
        .then(({ sendMentionNotification }) =>
          sendMentionNotification(userIds, getDisplayName(req.user!))
        )
        .catch(() => {});
    }
  }

  scheduleActivityReward(rewardChatMessage(req.user!.id));
  scheduleActivityReward(rewardOnlineSession(req.user!.id));

  res.status(201).json({
    message: serializeMessage(message as MessageRow, rankMap, req.user!.id),
  });
});

router.patch("/:id", requireAuth, sendLimit, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Nieprawidłowe ID wiadomości" });
  }

  const text = validateText(req.body.text);
  if (!text) {
    return res.status(400).json({ error: "Wiadomość nie może być pusta" });
  }

  const existing = await prisma.chatMessage.findUnique({
    where: { id },
    select: { id: true, userId: true, deletedAt: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "Wiadomość nie istnieje" });
  }

  if (existing.userId !== req.user!.id) {
    return res.status(403).json({ error: "Możesz edytować tylko własne wiadomości" });
  }

  if (existing.deletedAt) {
    return res.status(400).json({ error: "Nie można edytować usuniętej wiadomości" });
  }

  const mentionUsers = await loadMentionUsers();
  const { error: mentionError } = resolveMentionedUserIds(
    text,
    mentionUsers,
    req.user!.id,
    req.user!.role === "ADMIN",
  );
  if (mentionError) {
    return res.status(400).json({ error: mentionError });
  }

  const rankMap = await buildUserRankMap();
  const message = await prisma.chatMessage.update({
    where: { id },
    data: { text, editedAt: new Date() },
    select: messageSelect,
  });

  await syncMessageMentions(message.id, text, req.user!.id, req.user!.role === "ADMIN");

  res.json({ message: serializeMessage(message as MessageRow, rankMap, req.user!.id) });
});

router.post("/:id/heart", requireAuth, actionLimit, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Nieprawidłowe ID wiadomości" });
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });

  if (!message) {
    return res.status(404).json({ error: "Wiadomość nie istnieje" });
  }

  if (message.deletedAt) {
    return res.status(400).json({ error: "Nie można polubić usuniętej wiadomości" });
  }

  const userId = req.user!.id;
  const existing = await prisma.chatHeart.findUnique({
    where: { messageId_userId: { messageId: id, userId } },
    select: { id: true },
  });

  let hearted: boolean;
  if (existing) {
    await prisma.chatHeart.delete({ where: { id: existing.id } });
    hearted = false;
  } else {
    await prisma.chatHeart.create({ data: { messageId: id, userId } });
    hearted = true;
    scheduleActivityReward(rewardChatHeart(userId, id));
  }

  const heartCount = await prisma.chatHeart.count({ where: { messageId: id } });

  res.json({ hearted, heartCount });
});

/** Soft-delete — wiadomość zostaje w historii jako „usunięta” (bezpieczne dla wątków odpowiedzi). */
router.delete("/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Nieprawidłowe ID wiadomości" });
  }

  const existing = await prisma.chatMessage.findUnique({
    where: { id },
    select: { id: true, userId: true, deletedAt: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "Wiadomość nie istnieje" });
  }

  const isOwner = existing.userId === req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Brak uprawnień do usunięcia" });
  }

  if (existing.deletedAt) {
    return res.json({ ok: true });
  }

  await prisma.chatMessage.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  res.json({ ok: true });
});

export default router;
